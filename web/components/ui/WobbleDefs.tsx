/** 手绘抖动描边所需的 SVG 滤镜，在根布局渲染一次。 */
export function WobbleDefs() {
  return (
    <svg aria-hidden="true" style={{ position: "absolute", width: 0, height: 0 }}>
      <filter id="wobble">
        <feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves={2} seed={3} />
        <feDisplacementMap in="SourceGraphic" scale={5} />
      </filter>
      <filter id="wobble-s">
        <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves={2} seed={7} />
        <feDisplacementMap in="SourceGraphic" scale={3} />
      </filter>
    </svg>
  );
}
