import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './App.css';
import Noise from './Noise';

function ZoomableSVG({ children, width, height }) {
  const svgRef = useRef();
  const [k, setK] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);

  useEffect(() => {
    const zoom = d3.zoom().on("zoom", (event) => {
      const { x, y, k } = event.transform;
      setK(k);
      setX(x);
      setY(y);
    });

    d3.select(svgRef.current).call(zoom);
  }, []);

  return (
    <svg ref={svgRef} width={width} height={height}>
      <g transform={`translate(${x},${y}) scale(${k})`}>
        {children}
      </g>
    </svg>
  );
}

function App() {
  const [pathPairs, setPathPairs] = useState([]);
  const [logs, setLogs] = useState([]);
  const svgRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const asn = 17676;
  const [displayWidth, setDisplayWidth] = useState(window.innerWidth);
  const [displayHeight, setDisplayHeight] = useState(window.innerHeight);

  const connectWebSocket = () => {
    const ws = new WebSocket("wss://ris-live.ripe.net/v1/ws/?client=ts-manual-example");
    wsRef.current = ws;

    ws.onmessage = (message) => {
      const parsed = JSON.parse(message.data);
      if (parsed.data && Array.isArray(parsed.data.path)) {
        const path = parsed.data.path;
        const pairs = [];

        for (let i = 0; i < path.length - 1; i++) {
          pairs.push([path[i], path[i + 1]]);
        }

        const timestamp = Date.now();
        setPathPairs((prevPairs) => [...prevPairs, { pairs, timestamp }]);
        setLogs((prevLogs) => [`${path.join(' → ')}`, ...prevLogs]);
      }
    };

    ws.onopen = () => {
      const subscribeMessage = {
        type: "ris_subscribe",
        data: { path: asn }
      };
      ws.send(JSON.stringify(subscribeMessage));
      setIsConnected(true);
    };

    return () => {
      ws.close();
      setIsConnected(false);
    };
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        setIsConnected(false);
      }
    };
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const links = [];
    const nodesSet = new Set();

    pathPairs.forEach(({ pairs }) => {
      pairs.forEach(([source, target]) => {
        nodesSet.add(source);
        nodesSet.add(target);
        links.push({ source, target });
      });
    });

    const nodes = Array.from(nodesSet).map((id) => ({
      id,
      color: getColor(id)
    }));

    function getColor(id) {
      if (id === asn) {
        return 'hsl(0, 100%, 50%)';
      } else {
        return 'hsl(0, 0%, 100%)';
      }
    }

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(300))
      .force("charge", d3.forceManyBody().strength(-30))
      .force("center", d3.forceCenter(displayWidth / 3, displayHeight / 2))
      .on("tick", ticked);

    const link = svg.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.4)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1);

    const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 5)
      .attr("fill", d => d.color)
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.append("title")
      .text(d => d.id);

    svg.append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("x", d => d.x)
      .attr("y", d => d.y - 10)
      .attr("text-anchor", "middle")
      .text(d => d.id)
      .style("font-size", "10px")
      .style("fill", "#fff");

    function ticked() {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

      svg.selectAll(".labels text")
        .attr("x", d => d.x)
        .attr("y", d => d.y - 10);
    }

    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [pathPairs]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = Date.now();
      setPathPairs((prevPairs) =>
        prevPairs.filter(({ timestamp }) => currentTime - timestamp < 10000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    handleStart(); // ここでhandleStartを呼び出す
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        setIsConnected(false);
      }
    };
  }, []);

  const handleStop = () => {
    if (wsRef.current) {
      wsRef.current.close();
      setIsConnected(false);
    }
  };

  const handleStart = () => {
    if (!isConnected) {
      connectWebSocket();
    }
  };
  useEffect(() => {
    const handleResize = () => {
      setDisplayWidth(window.innerWidth);
      setDisplayHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    // スクロール無効化
    document.body.style.overflow = 'hidden';

    return () => {
      // スクロールを元に戻す
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <>
      <ZoomableSVG width={displayWidth} height={displayHeight}>
        <g ref={svgRef} />
      </ZoomableSVG>
      <div className="logs">
        <h3>RIS Logs</h3>
        <ul>
          {logs.slice(0, 20).map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
      </div>
  <Noise />
    </>
  );
}

export default App;
