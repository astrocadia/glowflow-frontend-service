import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SketchPicker } from "react-color";
import { Socket, io } from "socket.io-client";
import pencilImg from "../assets/pencil-cursor.png";
import logo from "../assets/glow-flow-logo.png";
import * as Constants from "./constants";
import "./App.css";
import useUndo from "./hooks/useUndo";
import Canvas from "./Canvas";
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
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<number | undefined>(100);
  const [broadcastAnimation, setBroadcastAnimation] = useState(false);
  const [color, setColor] = useState("#ff0000");
  const [brightness, setBrightness] = useState(1);
  const [gamma, setGamma] = useState(1);
  const [RGBAdjustment, setRGBAdjustment] = useState([1, 1, 1]);
  const [drawing, setDrawing] = useState(false);
  const [savedFrames, setSavedFrames, undoFrames] = useUndo<ImageData[]>([
    initialImageData,
  ]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);
  const [frameRate, setFrameRate] = useState<number>(10); // Default to 10fps
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationCanvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket>();

  const animateFrames = () => {
    const canvas = animationCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    let frameIndex = 0;

    const drawNextFrame = () => {
      if (frameIndex >= savedFrames.length) {
        frameIndex = 0; // loop back to the first frame if desired
      }

      const currentFrame = savedFrames[frameIndex];
      ctx?.putImageData(currentFrame, 0, 0);
      if (broadcastAnimation && animationCanvasRef.current) {
        sendE131Data(animationCanvasRef.current);
      }
      frameIndex++;
    };

    // Set an interval to draw each frame. Here, I've set it to 100ms (10fps), but adjust as needed.
    const intervalDuration = 1000 / frameRate;
    return window.setInterval(drawNextFrame, intervalDuration);
  };

  const deleteFrame = (index: number) => {
    setSavedFrames((prevFrames) =>
      prevFrames.filter((_, idx) => idx !== index)
    );
    if (selectedFrameIndex === index) {
      setSelectedFrameIndex(Math.max(0, index - 1));
    }
  };

  const AddNewFrame = () => {
    setSavedFrames((prevFrames) => [
      ...prevFrames.slice(0, selectedFrameIndex + 1),
      initialImageData,
      ...prevFrames.slice(selectedFrameIndex + 1),
    ]);
    setSelectedFrameIndex(selectedFrameIndex + 1);
  };

  const duplicateCurrentFrame = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    const imageData = ctx?.getImageData(
      0,
      0,
      Constants.CANVAS_WIDTH,
      Constants.CANVAS_HEIGHT
    );
    if (imageData) {
      setSavedFrames((prevFrames) => [
        ...prevFrames.slice(0, selectedFrameIndex + 1),
        imageData,
        ...prevFrames.slice(selectedFrameIndex + 1),
      ]);
    }
    setSelectedFrameIndex(selectedFrameIndex + 1);
  };

  const displayFrame = (frameData: ImageData, index: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    ctx?.putImageData(frameData, 0, 0);
    setSelectedFrameIndex(index);
  };

  const clearFrame = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    ctx?.putImageData(initialImageData, 0, 0);
    updateSelectedFrame();
    if (canvas) sendE131Data(canvas);
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

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        ctx?.drawImage(
          img,
          0,
          0,
          Constants.CANVAS_WIDTH,
          Constants.CANVAS_HEIGHT
        );
        // for (let i = 0; i < Constants.PIXEL_COUNT; i++) {
        //   let x;
        //   if ((Math.floor(i / Constants.MATRIX_SIZE))%2===0) {
        //     x = ((Constants.MATRIX_SIZE-1) * Constants.PIXEL_SIZE)-((i % Constants.MATRIX_SIZE) * Constants.PIXEL_SIZE);
        //   }
        //   else {
        //     x = (i % Constants.MATRIX_SIZE) * Constants.PIXEL_SIZE;
        //   }
        //   const y = ((Constants.MATRIX_SIZE-1) * Constants.PIXEL_SIZE) - (Math.floor(i / Constants.MATRIX_SIZE) * Constants.PIXEL_SIZE);
        //   const pixelColorData = ctx.getImageData(x, y, Constants.PIXEL_SIZE, Constants.PIXEL_SIZE);
        //   ctx.putImageData(pixelColorData, 0, 0)
        // }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

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
    const data = new Uint8Array(pixelData);
    socketRef.current?.emit("e131Data", data);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    handleCanvasClick(event);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    handleCanvasClick(event);
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

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(Constants.SOCKET_SERVER_URL);

    // Initialize canvas
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = Constants.CANVAS_WIDTH;
      canvas.height = Constants.CANVAS_HEIGHT;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, Constants.CANVAS_WIDTH, Constants.CANVAS_HEIGHT);
      }
    }
    // Clean up on unmount
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      const currentFrame = savedFrames[selectedFrameIndex];
      // extract to method
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (currentFrame) {
        ctx?.putImageData(currentFrame, 0, 0);
      } else {
        setSelectedFrameIndex(0);
        ctx?.putImageData(savedFrames[0], 0, 0);
      }
      sendE131Data(canvasRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedFrames, selectedFrameIndex]);

  useEffect(() => {
    const intervalId = animateFrames();

    // Cleanup on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId); // Use clearInterval to stop the animation
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedFrames, frameRate, broadcastAnimation]);

  const handleColorChange = (newColor: { hex: string }) => {
    setColor(newColor.hex);
  };
  useLayoutEffect(() => {
    if (canvasContainerRef.current) {
      const { clientHeight, clientWidth } = canvasContainerRef.current;
      let size = (clientHeight ?? 100) - 180;
      console.log({ size, clientWidth });
      if (clientWidth < size) size = clientWidth - 20;
      setCanvasSize(size);
    }
  }, []);
  return (
    <div className="app-container">
      <section className="tool-container">
        <SketchPicker width="80%" color={color} onChange={handleColorChange} />
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
              <canvas ref={animationCanvasRef} width={200}></canvas>
            </div>
          </div>
          <button
            className={"button-85" + (broadcastAnimation ? " selected" : "")}
            onClick={() => setBroadcastAnimation(!broadcastAnimation)}
          >
            Broadcast Animation
          </button>
        </div>
      </section>
      <section ref={canvasContainerRef} className="canvas-container">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            cursor: `url(${pencilImg}) 0 24, auto`,
            border: "1px solid white",
          }}
          height={canvasSize}
          width={canvasSize}
        />
        <div className="saved-canvas-container">
          {savedFrames.map((frame) => (
            <Canvas
              width={150}
              height={150}
              cellSize={1}
              color={frame.colorSpace}
              onCanvasUpdate={console.log}
              imageData={frame}
            />
          ))}
        </div>
      </section>
      <section className="tool-container">
        <div>
          <img src={logo} width={150} height={150} />
        </div>
        <div className="button-container">
          <button className="button-31" onClick={AddNewFrame}>
            Add New Frame
          </button>
          <button className="button-31" onClick={duplicateCurrentFrame}>
            Duplicate Frame
          </button>
          <button className="button-31" onClick={clearFrame}>
            Clear Frame
          </button>
          <button className="button-31" onClick={updateSelectedFrame}>
            Update Selected
          </button>
          <button className="button-31" onClick={undoFrames}>
            Undo
          </button>
          <button
            className="button-31"
            onClick={() => canvasRef.current && sendE131Data(canvasRef.current)}
          >
            Send
          </button>
        </div>
      </section>
    </div>
  );
};

export default App;
