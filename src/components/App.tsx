import { useLayoutEffect, useRef, useState } from "react";
import { SketchPicker } from "react-color";
import pencilImg from "../assets/pencil-cursor.png";
import logo from "../assets/glow-flow-logo.png";
import * as Constants from "./constants";
import "./App.css";
import useUndo from "./hooks/useUndo";
// import * as Constants from "./constants";

// Create a zero-filled Uint8ClampedArray for the ImageData
const initialDataArray = new Uint8ClampedArray(
  Constants.CANVAS_WIDTH * Constants.CANVAS_HEIGHT * 4
).fill(0);

// Create an ImageData object from the zero-filled array
const initialImageData = new ImageData(
  initialDataArray,
  Constants.CANVAS_WIDTH,
  Constants.CANVAS_HEIGHT
);
const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const animationCanvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState<number | undefined>(100);
  const [broadcastAnimation, setBroadcastAnimation] = useState(false);
  const [color, setColor] = useState("#ff0000");
  const [gamma, setGamma] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [RGBAdjustment, setRGBAdjustment] = useState([1, 1, 1]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);
  const [drawing, setDrawing] = useState(false);
  const [savedFrames, setSavedFrames, undoFrames] = useUndo<ImageData[]>([
    initialImageData,
  ]);
  const gammaCorrectionWithRGBAdjustment = (
    rgb: Uint8ClampedArray,
    gamma: number,
    rgbAdjustment: number[]
  ) => {
    const correctedRGB = [0, 0, 0];
    const totalBrightnessBefore = rgb[0] + rgb[1] + rgb[2];

    let redValue = rgb[0] * rgbAdjustment[0]; // Adjust the red channel
    let greenValue = rgb[1] * rgbAdjustment[1]; // Adjust the green channel
    let blueValue = rgb[2] * rgbAdjustment[2]; // Adjust the blue channel

    const totalBrightnessAfter = redValue + greenValue + blueValue;

    // If the total brightness has increased, scale the colors down to maintain the same brightness
    if (totalBrightnessAfter > totalBrightnessBefore) {
      const scale = totalBrightnessBefore / totalBrightnessAfter;
      redValue *= scale;
      greenValue *= scale;
      blueValue *= scale;
    }

    // Apply gamma correction
    correctedRGB[0] = Math.round(255 * Math.pow(redValue / 255, gamma));
    correctedRGB[1] = Math.round(255 * Math.pow(greenValue / 255, gamma));
    correctedRGB[2] = Math.round(255 * Math.pow(blueValue / 255, gamma));

    // Ensure the values don't exceed 255
    correctedRGB[0] = Math.min(255, correctedRGB[0]);
    correctedRGB[1] = Math.min(255, correctedRGB[1]);
    correctedRGB[2] = Math.min(255, correctedRGB[2]);

    return correctedRGB;
  };
  const sendE131Data = (canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const pixelData: number[] = [];

    for (let i = 0; i < Constants.PIXEL_COUNT; i++) {
      let x;
      if (Math.floor(i / Constants.MATRIX_SIZE) % 2 === 0) {
        x =
          (Constants.MATRIX_SIZE - 1) * Constants.PIXEL_SIZE -
          (i % Constants.MATRIX_SIZE) * Constants.PIXEL_SIZE;
      } else {
        x = (i % Constants.MATRIX_SIZE) * Constants.PIXEL_SIZE;
      }
      const y =
        (Constants.MATRIX_SIZE - 1) * Constants.PIXEL_SIZE -
        Math.floor(i / Constants.MATRIX_SIZE) * Constants.PIXEL_SIZE;
      const pixelColorData = ctx?.getImageData(
        x,
        y,
        Constants.PIXEL_SIZE,
        Constants.PIXEL_SIZE
      );
      if (pixelColorData) {
        const gammaCorrectedData = gammaCorrectionWithRGBAdjustment(
          pixelColorData.data,
          gamma,
          RGBAdjustment
        );
        const [r, g, b] = gammaCorrectedData;
        const adjustedR = Math.floor(r * brightness);
        const adjustedG = Math.floor(g * brightness);
        const adjustedB = Math.floor(b * brightness);
        pixelData.push(adjustedR, adjustedG, adjustedB);
      }
    }
    // const data = new Uint8Array(pixelData);
    // socketRef.current?.emit("e131Data", data);
  };
  const handleColorChange = (newColor: { hex: string }) => {
    setColor(newColor.hex);
  };
  const handleBrightnessChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setBrightness(parseFloat(event.target.value));
    if (canvasRef.current) sendE131Data(canvasRef.current);
  };

  const handleGammaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGamma(parseFloat(event.target.value));
    if (canvasRef.current) sendE131Data(canvasRef.current);
  };
  const drawPixel = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string
  ) => {
    ctx.fillStyle = color;
    ctx.fillRect(
      x * Constants.PIXEL_SIZE,
      y * Constants.PIXEL_SIZE,
      Constants.PIXEL_SIZE,
      Constants.PIXEL_SIZE
    );
  };
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    const rect = canvas?.getBoundingClientRect();
    if (rect && ctx) {
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const pixelX = Math.floor(x / Constants.PIXEL_SIZE);
      const pixelY = Math.floor(y / Constants.PIXEL_SIZE);

      drawPixel(ctx, pixelX, pixelY, color);
    }
  };
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    handleCanvasClick(event);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    handleCanvasClick(event);
  };
  const updateSelectedFrame = () => {
    if (selectedFrameIndex !== null) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      const imageData = ctx?.getImageData(
        0,
        0,
        Constants.CANVAS_WIDTH,
        Constants.CANVAS_HEIGHT
      );
      if (imageData) {
        setSavedFrames((prevFrames) =>
          prevFrames.map((frame, idx) =>
            idx === selectedFrameIndex ? imageData : frame
          )
        );
      }
      // setSelectedFrameIndex(null); // Reset the selected frame index
    }
  };
  const handleMouseUp = () => {
    setDrawing(false);
    if (canvasRef.current) {
      sendE131Data(canvasRef.current);
    }
    if (selectedFrameIndex !== null) {
      updateSelectedFrame();
    }
  };
  useLayoutEffect(() => {
    if (canvasContainerRef.current) {
      const { clientHeight, clientWidth } = canvasContainerRef.current;
      let size = (clientHeight ?? 100) - 20;
      if (clientWidth < size) size = clientWidth;
      setCanvasSize(size);
    }
  }, [canvasContainerRef.current]);
  return (
    <div className="app-container">
      <section className="tool-container">
        <SketchPicker color={color} onChange={handleColorChange} />
        <label>
          Brightness:
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={brightness}
            onChange={handleBrightnessChange}
          />
        </label>
        <span style={{ display: "inline-flex" }}>
          <label>
            Gamma Correction:
            <input
              type="range"
              min="0.1"
              max="3.0"
              step="0.1"
              value={gamma}
              onChange={handleGammaChange}
            />
          </label>
        </span>
        <div className="animation-container">
          <div className="scaled-animation-container">
            <div className="animation-content">
              <canvas ref={animationCanvasRef}></canvas>
            </div>
          </div>
          <button
            className={broadcastAnimation ? "button-selected" : ""}
            onClick={() => setBroadcastAnimation(!broadcastAnimation)}
          >
            Broadcast Animation
          </button>
        </div>
      </section>
      <section ref={canvasContainerRef} className="canvas-container">
        <canvas
          id="drawingCanvas"
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: `url(${pencilImg}) 0 24, auto` }}
          height={canvasSize}
          width={canvasSize}
        />
      </section>
      <section className="tool-container">
        <div>
          <img src={logo} width={150} height={150} />
        </div>
        <div className="button-container">
          <button>Add New Frame</button>
          <button>Duplicate Frame</button>
          <button>Clear Frame</button>
          <button>Update Selected</button>
          <button>Undo</button>
          <button>Send</button>
        </div>
      </section>
    </div>
  );
};

export default App;
