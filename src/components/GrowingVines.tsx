import { useEffect, useRef } from "react";

// Zarzas espinosas que crecen al abrir un juego y "generan" el panel.
// Tallos trazados con getTotalLength(); rosas en espiral en las puntas.

interface Props { show: boolean; }

export function GrowingVines({ show }: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!show || !ref.current) return;
    const stems = ref.current.querySelectorAll<SVGPathElement>(".stem");
    stems.forEach((stem, i) => {
      const len = stem.getTotalLength();
      stem.style.strokeDasharray = `${len}`;
      stem.style.strokeDashoffset = `${len}`;
      stem.getBoundingClientRect();
      stem.style.transition = `stroke-dashoffset 0.55s cubic-bezier(0.45,0,0.25,1) ${i * 0.06}s`;
      stem.style.strokeDashoffset = "0";
    });
  }, [show]);

  if (!show) return null;

  return (
    <div className="vines-bloom" aria-hidden="true">
      <svg ref={ref} viewBox="0 0 460 620" xmlns="http://www.w3.org/2000/svg" className="vines-svg" preserveAspectRatio="xMidYMax meet">
        <g className="vines-group">
          <path className="stem stem0" d="M230.0,620.0 Q230.0,620.0 242.3,602.0 Q254.6,584.1 263.8,566.1 Q273.1,548.1 277.4,530.2 Q281.8,512.2 280.4,494.2 Q279.0,476.2 272.4,458.3 Q265.9,440.3 255.6,422.3 Q245.4,404.4 233.9,386.4 Q222.3,368.4 212.0,350.5 Q201.7,332.5 194.8,314.5 Q187.9,296.6 185.7,278.6 Q183.6,260.6 186.5,242.7 Q189.4,224.7 196.6,206.7 Q203.7,188.8 213.4,170.8 Q223.1,152.8 233.2,134.8 Q243.3,116.9 251.5,98.9 Q259.8,80.9 264.5,63.0 T269.2,45.0" fill="none" stroke="#7a2230" strokeWidth={4.5} strokeLinecap="round" />
          <path className="stem stem1" d="M230.0,620.0 Q230.0,620.0 215.9,603.1 Q201.7,586.2 190.2,569.4 Q178.6,552.5 171.3,535.6 Q164.0,518.8 161.8,501.9 Q159.7,485.0 162.9,468.1 Q166.1,451.2 174.0,434.4 Q181.9,417.5 193.2,400.6 Q204.4,383.8 217.2,366.9 Q230.0,350.0 242.3,333.1 Q254.7,316.2 264.7,299.4 Q274.7,282.5 281.1,265.6 Q287.4,248.8 289.2,231.9 Q290.9,215.0 288.1,198.1 Q285.2,181.2 278.3,164.4 Q271.4,147.5 261.7,130.6 Q252.0,113.8 241.0,96.9 T230.0,80.0" fill="none" stroke="#7a2230" strokeWidth={4} strokeLinecap="round" />
          <path className="stem stem2" d="M230.0,620.0 Q230.0,620.0 250.6,602.7 Q271.1,585.3 285.1,568.0 Q299.1,550.6 302.5,533.3 Q306.0,515.9 298.3,498.6 Q290.7,481.2 274.4,463.9 Q258.2,446.6 238.4,429.2 Q218.7,411.9 201.2,394.5 Q183.7,377.2 173.6,359.8 Q163.4,342.5 163.3,325.2 Q163.1,307.8 172.7,290.5 Q182.3,273.1 198.4,255.8 Q214.5,238.4 232.3,221.1 Q250.1,203.8 264.3,186.4 Q278.5,169.1 285.1,151.7 Q291.7,134.4 289.2,117.0 Q286.6,99.7 275.9,82.3 T265.3,65.0" fill="none" stroke="#7a2230" strokeWidth={4} strokeLinecap="round" />
        </g>
        <g className="thorns-group">
          <path className="thorn" style={{ ["--d" as any]: 0.06 }} d="M257.2,579.8 L241.7,576.3 L252.0,588.4 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.12 }} d="M274.9,543.4 L287.1,553.4 L271.3,552.8 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.17 }} d="M282.2,507.2 L266.8,511.0 L281.4,517.2 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.17 }} d="M282.2,507.2 L296.7,513.4 L281.4,517.2 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.23 }} d="M278.0,471.4 L293.7,473.0 L280.1,481.1 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.29 }} d="M263.7,435.8 L252.3,446.7 L268.0,444.8 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.35 }} d="M242.8,400.1 L258.2,396.6 L248.0,408.7 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.35 }} d="M242.8,400.1 L232.6,412.1 L248.0,408.7 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.41 }} d="M219.7,364.2 L209.5,376.2 L224.9,372.7 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.46 }} d="M199.6,328.0 L215.2,326.0 L203.9,337.0 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.52 }} d="M186.7,291.7 L173.3,300.2 L189.1,301.4 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.52 }} d="M186.7,291.7 L202.4,292.9 L189.1,301.4 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.58 }} d="M183.7,255.6 L198.6,260.9 L183.5,265.6 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.64 }} d="M190.8,219.9 L175.0,220.6 L188.1,229.5 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.7 }} d="M205.9,184.2 L217.3,195.1 L201.6,193.3 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.7 }} d="M205.9,184.2 L190.2,182.4 L201.6,193.3 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.75 }} d="M225.6,148.4 L210.0,145.6 L220.7,157.2 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.81 }} d="M245.5,112.4 L256.6,123.7 L241.0,121.3 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.87 }} d="M261.5,76.2 L245.7,75.8 L258.1,85.6 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.87 }} d="M261.5,76.2 L273.9,86.0 L258.1,85.6 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.05 }} d="M198.7,582.3 L213.7,577.2 L204.8,590.2 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.11 }} d="M176.2,548.1 L165.5,559.8 L181.1,556.9 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.16 }} d="M162.6,513.9 L178.4,514.7 L165.3,523.6 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.16 }} d="M162.6,513.9 L149.5,522.8 L165.3,523.6 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.22 }} d="M159.8,480.0 L144.7,484.5 L159.5,490.0 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.27 }} d="M167.7,446.5 L180.4,455.9 L164.6,456.0 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.33 }} d="M184.4,413.2 L168.9,410.1 L179.5,421.8 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.33 }} d="M184.4,413.2 L195.0,424.9 L179.5,421.8 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.38 }} d="M207.3,379.7 L216.7,392.5 L201.5,387.8 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.44 }} d="M233.0,346.0 L218.0,341.0 L227.0,354.0 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.49 }} d="M257.4,312.1 L267.2,324.5 L251.9,320.4 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.49 }} d="M257.4,312.1 L242.2,308.0 L251.9,320.4 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.54 }} d="M276.9,278.0 L261.2,276.0 L272.6,287.0 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.6 }} d="M288.5,243.9 L302.0,252.2 L286.2,253.6 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.65 }} d="M290.8,210.0 L275.9,215.5 L291.1,220.0 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.65 }} d="M290.8,210.0 L305.9,214.5 L291.1,220.0 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.71 }} d="M283.8,176.4 L299.6,177.1 L286.6,186.1 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.76 }} d="M269.2,143.0 L258.0,154.1 L273.6,152.0 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.82 }} d="M249.4,109.5 L264.8,105.9 L254.6,118.0 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.82 }} d="M249.4,109.5 L239.2,121.6 L254.6,118.0 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.06 }} d="M274.7,581.8 L260.5,574.7 L267.6,588.9 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.11 }} d="M301.3,546.2 L312.5,557.4 L296.8,555.1 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.17 }} d="M305.4,511.0 L291.1,517.7 L306.6,520.9 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.17 }} d="M305.4,511.0 L320.9,514.1 L306.6,520.9 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.22 }} d="M287.8,477.1 L303.0,472.7 L293.5,485.4 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.28 }} d="M254.6,443.1 L247.8,457.4 L261.8,450.0 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.34 }} d="M215.0,408.5 L228.9,400.9 L222.3,415.3 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.34 }} d="M215.0,408.5 L208.4,422.9 L222.3,415.3 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.39 }} d="M180.6,373.3 L172.0,386.5 L186.8,381.1 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.45 }} d="M162.0,337.7 L177.8,338.2 L164.8,347.3 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.5 }} d="M164.5,303.0 L148.7,303.9 L161.8,312.6 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.5 }} d="M164.5,303.0 L177.6,311.7 L161.8,312.6 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.56 }} d="M185.2,269.1 L194.3,282.1 L179.3,277.1 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.62 }} d="M218.0,234.9 L203.8,228.0 L211.0,242.0 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.67 }} d="M253.5,200.1 L261.1,213.9 L246.7,207.4 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.67 }} d="M253.5,200.1 L239.1,193.6 L246.7,207.4 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.73 }} d="M281.0,164.8 L265.6,161.3 L275.9,173.3 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.78 }} d="M292.3,129.4 L306.6,136.1 L291.1,139.3 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.84 }} d="M284.8,95.0 L272.6,105.0 L288.4,104.4 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
          <path className="thorn" style={{ ["--d" as any]: 0.84 }} d="M284.8,95.0 L300.6,94.3 L288.4,104.4 Z" fill="#9a2a38" stroke="#5e1a24" strokeWidth={0.5} />
        </g>
        <g className="buds-group">
          <Rose x={269.2} y={45.0} cls="bud0" />
          <Rose x={230.0} y={80.0} cls="bud1" />
          <Rose x={265.3} y={65.0} cls="bud2" />
        </g>
      </svg>
    </div>
  );
}

// Pétalo redondeado tipo rosa: punta roma y ancha, lados curvos.
function petalPath(cx: number, cy: number, angle: number, dist: number, size: number, wf: number) {
  const a = (angle * Math.PI) / 180;
  const bx = cx + Math.cos(a) * dist;
  const by = cy + Math.sin(a) * dist;
  const tx = cx + Math.cos(a) * (dist + size);
  const ty = cy + Math.sin(a) * (dist + size);
  const pa = a + Math.PI / 2;
  const w = size * wf;
  const l1x = bx + Math.cos(pa) * w * 0.4, l1y = by + Math.sin(pa) * w * 0.4;
  const l2x = tx + Math.cos(pa) * w, l2y = ty + Math.sin(pa) * w;
  const r2x = tx - Math.cos(pa) * w, r2y = ty - Math.sin(pa) * w;
  const r1x = bx - Math.cos(pa) * w * 0.4, r1y = by - Math.sin(pa) * w * 0.4;
  const apx = cx + Math.cos(a) * (dist + size * 1.15);
  const apy = cy + Math.sin(a) * (dist + size * 1.15);
  return `M${bx.toFixed(1)},${by.toFixed(1)} C${l1x.toFixed(1)},${l1y.toFixed(1)} ${l2x.toFixed(1)},${l2y.toFixed(1)} ${apx.toFixed(1)},${apy.toFixed(1)} C${r2x.toFixed(1)},${r2y.toFixed(1)} ${r1x.toFixed(1)},${r1y.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)} Z`;
}

function Rose({ x, y, cls }: { x: number; y: number; cls: string }) {
  // Cuatro capas de pétalos redondeados, de oscuro (fuera) a vivo (centro).
  return (
    <g className={`bud ${cls}`} style={{ transformOrigin: `${x}px ${y}px` }}>
      <circle cx={x} cy={y} r={22} fill="#6b1d28" opacity={0.3} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path key={`o${a}`} d={petalPath(x, y, a, 3, 15, 0.7)} fill="#7a1f2b" stroke="#5e1a24" strokeWidth={0.4} />
      ))}
      {[30, 90, 150, 210, 270, 330].map((a) => (
        <path key={`m${a}`} d={petalPath(x, y, a, 2, 11, 0.7)} fill="#9c2c3a" />
      ))}
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={`i${a}`} d={petalPath(x, y, a, 1, 7, 0.72)} fill="#bd3a48" />
      ))}
      {[0, 120, 240].map((a) => (
        <path key={`c${a}`} d={petalPath(x, y, a, 0.5, 4, 0.8)} fill="#cc4450" />
      ))}
      <circle cx={x} cy={y} r={2} fill="#4a1018" />
    </g>
  );
}
