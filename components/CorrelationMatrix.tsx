import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Asset } from '../constants';
import { calculateCorrelation } from '../lib/utils';

interface Props {
  assets: Asset[];
  onCellHover: (a1: Asset | null, a2: Asset | null, r: number | null) => void;
}

export default function CorrelationMatrix({ assets, onCellHover }: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !assets.length) return;

    const mg = { top: 60, right: 20, bottom: 20, left: 60 };
    const W = 380 - mg.left - mg.right;
    const H = 380 - mg.top - mg.bottom;

    d3.select(ref.current).selectAll('*').remove();

    const svg = d3.select(ref.current)
      .attr('width', W + mg.left + mg.right)
      .attr('height', H + mg.top + mg.bottom)
      .append('g')
      .attr('transform', `translate(${mg.left},${mg.top})`);

    const labels = assets.map(a => a.symbol);
    const x = d3.scaleBand().range([0, W]).domain(labels).padding(0.06);
    const y = d3.scaleBand().range([0, H]).domain(labels).padding(0.06);
    const col = d3.scaleLinear<string>().domain([-1, 0, 1]).range(['#ef4444', '#f8fafc', '#3b82f6']);

    const data: { x: string; y: string; r: number; a1: Asset; a2: Asset }[] = [];
    assets.forEach(a1 => assets.forEach(a2 => {
      data.push({ x: a1.symbol, y: a2.symbol, r: calculateCorrelation(a1.returns, a2.returns), a1, a2 });
    }));

    svg.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', d => x(d.x) ?? 0)
      .attr('y', d => y(d.y) ?? 0)
      .attr('rx', 5).attr('ry', 5)
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .style('fill', d => col(d.r) ?? '#f8fafc')
      .style('stroke', '#e2e8f0')
      .style('stroke-width', 1)
      .on('mouseover', (ev, d) => {
        d3.select(ev.currentTarget).style('stroke', '#1e293b').style('stroke-width', 2.5);
        onCellHover(d.a1, d.a2, d.r);
      })
      .on('mouseleave', ev => {
        d3.select(ev.currentTarget).style('stroke', '#e2e8f0').style('stroke-width', 1);
        onCellHover(null, null, null);
      });

    svg.selectAll('text.val')
      .data(data)
      .enter()
      .append('text')
      .attr('x', d => (x(d.x) ?? 0) + x.bandwidth() / 2)
      .attr('y', d => (y(d.y) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .text(d => `${Math.round(d.r * 100)}%`)
      .style('font-size', '10px')
      .style('font-weight', '700')
      .style('fill', d => Math.abs(d.r) > 0.5 ? '#fff' : '#1e293b')
      .style('pointer-events', 'none');

    // Column labels (top)
    svg.append('g')
      .attr('transform', 'translate(0,-10)')
      .selectAll('text')
      .data(labels)
      .enter()
      .append('text')
      .attr('x', d => (x(d) ?? 0) + x.bandwidth() / 2)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .text(d => d)
      .style('font-size', '12px')
      .style('font-weight', '700')
      .style('fill', '#64748b');

    // Row labels (left)
    svg.append('g')
      .attr('transform', 'translate(-10,0)')
      .selectAll('text')
      .data(labels)
      .enter()
      .append('text')
      .attr('x', 0)
      .attr('y', d => (y(d) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '.35em')
      .attr('text-anchor', 'end')
      .text(d => d)
      .style('font-size', '12px')
      .style('font-weight', '700')
      .style('fill', '#64748b');
  }, [assets]);

  return (
    <div className="flex justify-center bg-white p-3 rounded-xl border border-slate-100 overflow-x-auto">
      <svg ref={ref} />
    </div>
  );
}
