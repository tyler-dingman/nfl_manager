import { Pressable, Text, View } from 'react-native';
import { MAX_ALT_ODDS } from '../../../packages/parlay/discovery-preferences';
import { useDiscoveryPreferences } from '../lib/parlay-discovery-preferences';
import { SectionMenu } from './section-menu';
export function ParlayDiscoveryControls({
  myTeamOnly,
  onTeamChange,
}: {
  myTeamOnly: boolean;
  onTeamChange: (value: boolean) => void;
}) {
  const discovery = useDiscoveryPreferences();
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        <Pressable
          accessibilityRole="checkbox"
          aria-checked={myTeamOnly}
          accessibilityLabel="My Team Only"
          accessibilityState={{ checked: myTeamOnly }}
          onPress={() => onTeamChange(!myTeamOnly)}
          style={{ paddingVertical: 12 }}
        >
          <Text style={{ color: '#A8BAC4' }}>{myTeamOnly ? '☑' : '☐'} My Team Only</Text>
        </Pressable>
        <Pressable
          accessibilityRole="checkbox"
          aria-checked={discovery.altLines}
          accessibilityLabel="Alt Lines"
          accessibilityState={{ checked: discovery.altLines, disabled: !discovery.ready }}
          disabled={!discovery.ready}
          onPress={() => discovery.update({ altLines: !discovery.altLines })}
          style={{ paddingVertical: 12 }}
        >
          <Text style={{ color: '#A8BAC4' }}>{discovery.altLines ? '☑' : '☐'} Alt Lines</Text>
        </Pressable>
      </View>
      {discovery.altLines && (
        <SectionMenu
          dark
          title={`Max Odds: ${discovery.maxOdds}`}
          items={MAX_ALT_ODDS.map((value) => ({
            label: String(value),
            selected: value === discovery.maxOdds,
            onPress: () => discovery.update({ maxOdds: value }),
          }))}
        />
      )}
    </>
  );
}
