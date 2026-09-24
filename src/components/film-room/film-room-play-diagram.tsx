/** Shared by Film Room and Trivia; matches the Parlay Lab hero decoration. */
export default function FilmRoomPlayDiagram() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 left-[48%] bg-cover bg-center bg-no-repeat opacity-[0.09] max-[700px]:left-[35%] max-[700px]:opacity-[0.06]"
      style={{ backgroundImage: "url('/assets/4-minute-drill/svg/playbook-xo-arrows.svg')" }}
    />
  );
}
