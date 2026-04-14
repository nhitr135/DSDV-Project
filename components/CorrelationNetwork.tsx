import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Asset } from '../constants';
import { calculateCorrelation } from '../lib/utils';

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  symbol: string;
  color: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  value: number;
}

interface Props {
  assets: Asset[];
}

export default function CorrelationNetwork({ assets }: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !assets.length) return;

    const W = 380, H = 280;
    d3.select(ref.current).selectAll('*').remove();

    const svg = d3.select(ref.current)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('width', '100%')
      .attr('height', H);

    const nodes: SimNode[] = assets.map(a => ({ id: a.id, symbol: a.symbol, color: a.color }));
    const links: SimLink[] = [];

    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const r = calculateCorrelation(assets[i].returns, assets[j].returns);
        if (Math.abs(r) > 0.25) {
          links.push({ source: assets[i].id, target: assets[j].id, value: r });
        }
      }
    }

    const sim = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id(d => d.id).distance(90))
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(28));

    const link = svg.append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.value > 0 ? '#3b82f6' : '#ef4444')
      .attr('stroke-opacity', 0.55)
      .attr('stroke-width', d => Math.abs(d.value) * 7);

    const node = svg.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    node.append('circle')
      .attr('r', 22)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2.5);

    node.append('text')
      .text(d => d.symbol)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('fill', '#fff')
      .style('font-size', '10px')
      .style('font-weight', '700')
      .style('pointer-events', 'none');

    sim.on('tick', () => {
      link
        .attr('x1', d => (d.source as SimNode).x ?? 0)
        .attr('y1', d => (d.source as SimNode).y ?? 0)
        .attr('x2', d => (d.target as SimNode).x ?? 0)
        .attr('y2', d => (d.target as SimNode).y ?? 0);
      node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });
  }, [assets]);

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
        Correlation Network
      </div>
      <svg ref={ref} style={{ display: 'block' }} />
      <div className="flex justify-center gap-4 text-[10px] text-slate-400 mt-2">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3.5 h-0.5 bg-blue-500" />Positive
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3.5 h-0.5 bg-red-500" />Negative
        </span>
        <span className="italic">Thickness = Strength</span>
      </div>
    </div>
  );
}
