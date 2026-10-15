/** Splits a heading into words that rise one after another, like the reference site. */
export function Words({ text, stagger = 0.05 }: { text: string; stagger?: number }) {
  const words = text.split(" ");
  return (
    <span aria-label={text} style={{ ["--stagger" as string]: `${stagger}s` }}>
      {words.map((word, i) => (
        <span aria-hidden="true" className="word" key={`${word}-${i}`} style={{ ["--i" as string]: i }}>
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
