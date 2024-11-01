import React, { useRef, useEffect } from "react";
import p5 from "p5";
import "./Noise.css"; // CSSのインポート

const Noise: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sketch = (p: p5) => {
      const generateNoise = () => {
        const w = p.windowWidth * 2;
        const h = p.windowHeight * 2;
        const data = new Uint32Array(w * h);
        for (let i = 0; i < data.length; i++) {
          data[i] = p.random(0, 0xFFFFFFFF);
        }
        const img = new ImageData(new Uint8ClampedArray(data.buffer), w, h);
        const ctx = p.drawingContext as CanvasRenderingContext2D;
        ctx.putImageData(img, 0, 0);
      };

      // 初期化
      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent(canvasRef.current!);
        generateNoise(); // ノイズを一度だけ生成
      };

      // ウィンドウのリサイズ
      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        generateNoise(); // リサイズ時に再生成
      };
    };

    // p5 インスタンスの生成
    const p5Instance = new p5(sketch);

    // コンポーネントがアンマウントされるときに p5 インスタンスをクリーンアップ
    return () => {
      p5Instance.remove();
    };
  }, []); // 空の依存配列を使用

  // キャンバスの表示
  return <div ref={canvasRef} className="NoiseCanvas"></div>;
};

export default Noise;
