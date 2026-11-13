import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
}

interface Link {
  source: string;
  target: string;
}

interface KnowledgeGraphProps {
  nodes: Node[];
  links: Link[];
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ nodes, links }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !nodes || !links) return;

    try {
      const width = 600;
      const height = 400;

      // Deep clone to prevent D3 from mutating React state
      const nodeData = nodes.map((d, i) => ({ ...d, id: d.id || d.label || `node-${i}` }));
      // Filter out links that reference non-existent nodes to prevent d3 crash
      const validNodeIds = new Set(nodeData.map(d => d.id));
      const linkData = links
        .filter(l => validNodeIds.has(l.source) && validNodeIds.has(l.target))
        .map(d => ({ ...d }));

      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      const simulation = d3.forceSimulation<Node>(nodeData)
        .force('link', d3.forceLink<Node, Link>(linkData).id((d) => d.id))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));

      const link = svg.append('g')
        .selectAll('line')
        .data(linkData)
        .join('line')
        .attr('stroke', '#444746')
        .attr('stroke-width', 1);

      const node = svg.append('g')
        .selectAll('circle')
        .data(nodeData)
        .join('circle')
        .attr('r', 8)
        .attr('fill', '#6366f1'); // Indigo-500

      const label = svg.append('g')
        .selectAll('text')
        .data(nodeData)
        .join('text')
        .attr('fill', '#e3e3e3')
        .attr('font-size', '10px')
        .text(d => typeof d.label === 'string' ? d.label : JSON.stringify(d.label || d.id));

      simulation.on('tick', () => {
        link
          .attr('x1', d => (d.source as any).x)
          .attr('y1', d => (d.source as any).y)
          .attr('x2', d => (d.target as any).x)
          .attr('y2', d => (d.target as any).y);

        node
          .attr('cx', d => (d as any).x)
          .attr('cy', d => (d as any).y);
          
        label
          .attr('x', d => (d as any).x + 10)
          .attr('y', d => (d as any).y + 3);
      });
      
      // Simple drag behavior
      node.call(d3.drag<SVGCircleElement, Node>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          (d as any).fx = (d as any).x;
          (d as any).fy = (d as any).y;
        })
        .on('drag', (event, d) => {
          (d as any).fx = event.x;
          (d as any).fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          (d as any).fx = null;
          (d as any).fy = null;
        }));
    } catch (e) {
      console.error("Knowledge Graph rendering error:", e);
    }

  }, [nodes, links]);

  return <svg ref={svgRef} width="100%" height="400" viewBox="0 0 600 400" />;
};
