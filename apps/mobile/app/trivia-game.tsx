import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, Eyebrow, Heading } from '../components/screen';
import { BuddyTriviaLobby } from '../components/buddy-trivia-lobby';
import { answerTriviaGame, getTriviaGame, startTriviaGame } from '../lib/api';
import type { TriviaChoice, TriviaGame, TriviaGameResult } from '../lib/types';
import { useTeam } from '../lib/team-context';

const choices: TriviaChoice[] = ['A', 'B', 'C', 'D'];
export default function Game() {
  const { teamId } = useTeam();
  const { mode, gameId } = useLocalSearchParams<{ mode?: string; gameId?: string }>();
  const [game, setGame] = useState<TriviaGame | null>(null), [result, setResult] = useState<TriviaGameResult | null>(null);
  const [selected, setSelected] = useState<TriviaChoice | null>(null), [seconds, setSeconds] = useState(20);
  const [loading, setLoading] = useState(true), [submitting, setSubmitting] = useState(false), [error, setError] = useState<string | null>(null);
  const timeoutSent = useRef(false);
  const start = useCallback(async () => { setLoading(true); setError(null); setResult(null); setSelected(null); try { setGame(await startTriviaGame(teamId)); } catch (e) { setError(e instanceof Error ? e.message : 'Trivia is unavailable.'); } finally { setLoading(false); } }, [teamId]);
  useEffect(() => {
    if (mode === 'solo') void start();
    else if (mode === 'shared' && gameId) {
      setLoading(true);
      void getTriviaGame(gameId)
        .then(setGame)
        .catch((caught) => setError(caught instanceof Error ? caught.message : 'Trivia is unavailable.'))
        .finally(() => setLoading(false));
    } else setLoading(false);
  }, [gameId, mode, start]);
  const answer = useCallback(async (choice: TriviaChoice | null) => {
    if (!game?.question || result || submitting) return;
    setSelected(choice); setSubmitting(true); setError(null); timeoutSent.current = true;
    try { setResult(await answerTriviaGame(game.gameId, choice)); }
    catch (e) { setSelected(null); timeoutSent.current = false; setError(e instanceof Error ? e.message : 'Unable to submit answer.'); }
    finally { setSubmitting(false); }
  }, [game, result, submitting]);
  useEffect(() => {
    if (!game?.question || result) return;
    timeoutSent.current = false;
    const tick = () => { const left = Math.min(game.timerSeconds, Math.max(0, game.timerSeconds - Math.floor((Date.now() - new Date(game.question!.presentedAt).getTime()) / 1000))); setSeconds(left); if (!left && !timeoutSent.current) { timeoutSent.current = true; void answer(null); } };
    tick(); const timer = setInterval(tick, 250); return () => clearInterval(timer);
  }, [answer, game, result]);
  useEffect(() => {
    if (!game?.waitingForPlayers || result) return;
    const timer = setInterval(() => {
      void getTriviaGame(game.gameId).then(setGame).catch(() => undefined);
    }, 1000);
    return () => clearInterval(timer);
  }, [game?.gameId, game?.waitingForPlayers, result]);
  const next = async () => { if (!game) return; setLoading(true); setResult(null); setSelected(null); setError(null); try { setGame(await getTriviaGame(game.gameId)); timeoutSent.current = false; } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load the next question.'); } finally { setLoading(false); } };
  if (mode === 'buddies') return <ScrollView style={s.page} contentContainerStyle={s.body}><BuddyTriviaLobby teamId={teamId} onLaunch={(id) => router.replace({ pathname: '/trivia-game', params: { mode: 'shared', gameId: id } })} /></ScrollView>;
  if (loading && !game) return <View style={s.center}><ActivityIndicator color={C.red} size="large" /><Text style={s.message}>Setting the questions…</Text></View>;
  if (error && !game) return <View style={s.center}><Heading>Trivia unavailable</Heading><Text style={s.message}>{error}</Text><Button label="TRY AGAIN" onPress={() => void start()} /><Done /></View>;
  if (!game) return null;
  if (game.completed) return <ScrollView style={s.page} contentContainerStyle={s.final}><Eyebrow>FINAL WHISTLE</Eyebrow><Heading>{game.score} points</Heading><Text style={s.score}>{game.correctAnswers} of {game.questionCount} correct</Text>{game.standings?.length ? <View style={s.standings}>{game.standings.map((player, index) => <View key={player.userId} style={s.standing}><Text style={s.rank}>#{index + 1}</Text><Text style={s.standingName}>{player.name}</Text><Text style={s.standingScore}>{player.score} PTS</Text></View>)}</View> : null}{mode === 'solo' ? <Button label="PLAY AGAIN" onPress={() => void start()} /> : null}<Done /></ScrollView>;
  const q = game.question;
  if (!q) return <View style={s.center}><Heading>{game.waitingForPlayers ? 'Waiting on the crew…' : 'Loading next play…'}</Heading>{game.waitingForPlayers ? <Text style={s.message}>The next question starts when everyone answers or the clock expires.</Text> : null}</View>;
  const answers: Record<TriviaChoice, string> = { A:q.answerA, B:q.answerB, C:q.answerC, D:q.answerD };
  return <ScrollView style={s.page} contentContainerStyle={s.body}>
    <View style={s.meta}><Text style={s.progress}>QUESTION {game.position} OF {game.questionCount}</Text><Text style={[s.clock, seconds <= 5 && s.urgent]}>{seconds}s</Text></View>
    <View style={s.track}><View style={[s.fill, { width: `${(game.position / game.questionCount) * 100}%` }]} /></View>
    <Eyebrow>{q.category.replaceAll('_', ' ')}</Eyebrow><Heading>{q.question}</Heading>
    <View style={s.answers}>{choices.map(choice => { const correct = result?.correctAnswer === choice, picked = selected === choice; return <Pressable key={choice} disabled={Boolean(result) || submitting} style={[s.answer, picked && s.selected, result && correct && s.right, result && picked && !correct && s.wrong]} onPress={() => void answer(choice)}><Text style={s.choice}>{choice}</Text><Text style={s.answerText}>{answers[choice]}</Text></Pressable>; })}</View>
    {submitting ? <ActivityIndicator color={C.red} /> : null}
    {result ? <View style={s.reveal}><Text style={[s.resultLabel, result.correct ? s.correct : s.incorrect]}>{result.correct ? `CORRECT · +${result.points}` : result.timedOut ? 'TIME EXPIRED' : 'NOT THIS TIME'}</Text><Text style={s.explanation}>{result.explanation}</Text>{result.yardAwarded ? <Text style={s.yards}>+{result.yardAwarded} yards earned</Text> : null}<Button label={result.completed ? 'SEE FINAL SCORE' : 'NEXT QUESTION'} onPress={() => void next()} /></View> : null}
    {error ? <Text style={s.error}>{error}</Text> : null}
  </ScrollView>;
}
function Button({label,onPress}:{label:string;onPress:()=>void}) { return <Pressable style={s.primary} onPress={onPress}><Text style={s.primaryText}>{label}</Text></Pressable>; }
function Done() { return <Pressable style={s.secondary} onPress={() => router.replace('/trivia')}><Text style={s.secondaryText}>BACK TO TRIVIA</Text></Pressable>; }
const s=StyleSheet.create({page:{flex:1,backgroundColor:C.cream},body:{padding:20,paddingBottom:42},final:{flexGrow:1,padding:24,justifyContent:'center'},center:{flex:1,backgroundColor:C.cream,justifyContent:'center',padding:24},message:{color:C.muted,fontSize:16,lineHeight:23,marginTop:14,textAlign:'center'},meta:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},progress:{fontWeight:'900',fontSize:13,letterSpacing:1.2,color:C.muted},clock:{fontSize:20,fontWeight:'900',color:C.navy},urgent:{color:C.red},track:{height:5,borderRadius:3,backgroundColor:'#DED8CF',marginTop:12,marginBottom:26,overflow:'hidden'},fill:{height:5,backgroundColor:C.red},answers:{marginTop:24},answer:{minHeight:66,borderRadius:16,borderWidth:1,borderColor:'#D6D8DA',backgroundColor:C.white,padding:15,marginBottom:10,flexDirection:'row',alignItems:'center'},selected:{borderColor:C.red,borderWidth:2},right:{borderColor:'#18864B',backgroundColor:'#E9F7EF'},wrong:{borderColor:C.red,backgroundColor:'#FFF0EF'},choice:{color:C.red,fontSize:16,fontWeight:'900',width:32},answerText:{flex:1,color:C.ink,fontSize:16,lineHeight:21,fontWeight:'700'},reveal:{backgroundColor:C.white,borderRadius:18,padding:18,marginTop:12},resultLabel:{fontSize:14,fontWeight:'900',letterSpacing:1.1},correct:{color:'#18864B'},incorrect:{color:C.red},explanation:{color:C.ink,fontSize:15,lineHeight:22,marginTop:10},yards:{color:C.red,fontSize:14,fontWeight:'900',marginTop:10},score:{color:C.muted,fontSize:18,marginTop:12,textAlign:'center'},error:{color:C.red,fontSize:14,textAlign:'center',marginTop:12},primary:{backgroundColor:C.red,borderRadius:14,padding:17,alignItems:'center',marginTop:20},primaryText:{color:C.white,fontSize:14,fontWeight:'900',letterSpacing:1},secondary:{borderColor:C.navy,borderWidth:1,borderRadius:14,padding:16,alignItems:'center',marginTop:14},secondaryText:{color:C.navy,fontSize:14,fontWeight:'900',letterSpacing:1},standings:{marginTop:24},standing:{backgroundColor:C.white,borderRadius:12,padding:14,marginBottom:8,flexDirection:'row',alignItems:'center'},rank:{color:C.red,fontSize:15,fontWeight:'900',width:38},standingName:{flex:1,color:C.ink,fontSize:15,fontWeight:'900'},standingScore:{color:C.muted,fontSize:13,fontWeight:'900'}});
