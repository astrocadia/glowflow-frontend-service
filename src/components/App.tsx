import React, { useEffect, useState, useRef } from 'react';
import { SketchPicker } from 'react-color';
import { io } from 'socket.io-client';
import pencilImg from '../assets/pencil-cursor.png'
import './App.css'
import * as Constants from './constants';
import FrameList from './FrameList';
import useUndo  from './hooks/useUndo'

// Create a zero-filled Uint8ClampedArray for the ImageData
const initialDataArray = new Uint8ClampedArray(Constants.CANVAS_WIDTH * Constants.CANVAS_HEIGHT * 4).fill(0);

// Create an ImageData object from the zero-filled array
const initialImageData = new ImageData(initialDataArray, Constants.CANVAS_WIDTH, Constants.CANVAS_HEIGHT);

const App = () => {
  const [broadcastAnimation, setBroadcastAnimation] = useState(false);
  const [color, setColor] = useState('#ff0000');
  const [brightness, setBrightness] = useState(1);
  const [gamma, setGamma] = useState(1);
  const [RGBAdjustment, setRGBAdjustment] = useState([1, 1, 1]);
  const [drawing, setDrawing] = useState(false);
  const [savedFrames, setSavedFrames, undoFrames] = useUndo<ImageData[]>([initialImageData]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);
  const [frameRate, setFrameRate] = useState<number>(10);  // Default to 10fps
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationCanvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<SocketIOClient.Socket>();

  const animateFrames = () => {
    const canvas = animationCanvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let frameIndex = 0;
    
    const drawNextFrame = () => {
        if (frameIndex >= savedFrames.length) {
            frameIndex = 0; // loop back to the first frame if desired
        }

        const currentFrame = savedFrames[frameIndex];
        ctx.putImageData(currentFrame, 0, 0);
        if (broadcastAnimation) {
          sendE131Data(animationCanvasRef.current!);
        }
        frameIndex++;
    };

    // Set an interval to draw each frame. Here, I've set it to 100ms (10fps), but adjust as needed.
    const intervalDuration = 1000 / frameRate;
    return window.setInterval(drawNextFrame, intervalDuration);
};

  const deleteFrame = (index: number) => {
    setSavedFrames(prevFrames => prevFrames.filter((_, idx) => idx !== index));
    if (selectedFrameIndex === index) {
      setSelectedFrameIndex(Math.max(0, index - 1));
    }
  };

  const saveCurrentFrame = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const imageData = ctx.getImageData(0, 0, Constants.CANVAS_WIDTH, Constants.CANVAS_HEIGHT);
    setSavedFrames(prevFrames => [...prevFrames.slice(0, selectedFrameIndex + 1), initialImageData, ...prevFrames.slice(selectedFrameIndex + 1, )]);
    setSelectedFrameIndex(selectedFrameIndex + 1)
    console.log(imageData)
  };

  const duplicateCurrentFrame = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const imageData = ctx.getImageData(0, 0, Constants.CANVAS_WIDTH, Constants.CANVAS_HEIGHT);
    setSavedFrames(prevFrames => [...prevFrames.slice(0, selectedFrameIndex + 1), imageData, ...prevFrames.slice(selectedFrameIndex + 1, )]);
    setSelectedFrameIndex(selectedFrameIndex + 1)
    console.log(imageData)
  };

  const displayFrame = (frameData: ImageData, index: number) => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.putImageData(frameData, 0, 0);
    setSelectedFrameIndex(index)
};

  const updateSelectedFrame = () => {
    if (selectedFrameIndex !== null) {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const imageData = ctx.getImageData(0, 0, Constants.CANVAS_WIDTH, Constants.CANVAS_HEIGHT);
        setSavedFrames(prevFrames => prevFrames.map((frame, idx) => idx === selectedFrameIndex ? imageData : frame));
        // setSelectedFrameIndex(null); // Reset the selected frame index
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files![0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, Constants.CANVAS_WIDTH, Constants.CANVAS_HEIGHT);
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
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  };

  const gammaCorrectionWithRGBAdjustment = (
    rgb: Uint8ClampedArray, 
    gamma: number, 
    rgbAdjustment: number[]
  ) => {
    let correctedRGB = [0, 0, 0];
    let totalBrightnessBefore = rgb[0] + rgb[1] + rgb[2];

    let redValue = rgb[0] * rgbAdjustment[0]; // Adjust the red channel
    let greenValue = rgb[1] * rgbAdjustment[1]; // Adjust the green channel
    let blueValue = rgb[2] * rgbAdjustment[2]; // Adjust the blue channel

    let totalBrightnessAfter = redValue + greenValue + blueValue;

    // If the total brightness has increased, scale the colors down to maintain the same brightness
    if (totalBrightnessAfter > totalBrightnessBefore) {
        let scale = totalBrightnessBefore / totalBrightnessAfter;
        redValue *= scale;
        greenValue *= scale;
        blueValue *= scale;
    }

    // Apply gamma correction
    correctedRGB[0] = Math.round(255 * Math.pow((redValue / 255), gamma));
    correctedRGB[1] = Math.round(255 * Math.pow((greenValue / 255), gamma));
    correctedRGB[2] = Math.round(255 * Math.pow((blueValue / 255), gamma));

    // Ensure the values don't exceed 255
    correctedRGB[0] = Math.min(255, correctedRGB[0]);
    correctedRGB[1] = Math.min(255, correctedRGB[1]);
    correctedRGB[2] = Math.min(255, correctedRGB[2]);

    return correctedRGB;
  }

  const sendE131Data = (canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const pixelData: number[] = [];

    for (let i = 0; i < Constants.PIXEL_COUNT; i++) {
      let x;
      if ((Math.floor(i / Constants.MATRIX_SIZE))%2===0) {
        x = ((Constants.MATRIX_SIZE-1) * Constants.PIXEL_SIZE)-((i % Constants.MATRIX_SIZE) * Constants.PIXEL_SIZE);
      }
      else {
        x = (i % Constants.MATRIX_SIZE) * Constants.PIXEL_SIZE;
      }
      const y = ((Constants.MATRIX_SIZE-1) * Constants.PIXEL_SIZE) - (Math.floor(i / Constants.MATRIX_SIZE) * Constants.PIXEL_SIZE);
      const pixelColorData = ctx.getImageData(x, y, Constants.PIXEL_SIZE, Constants.PIXEL_SIZE);
      const gammaCorrectedData = gammaCorrectionWithRGBAdjustment(pixelColorData.data, gamma, RGBAdjustment)
      const [r, g, b] = gammaCorrectedData;
      const adjustedR = Math.floor(r * brightness);
      const adjustedG = Math.floor(g * brightness);
      const adjustedB = Math.floor(b * brightness);
      pixelData.push(adjustedR, adjustedG, adjustedB);
    }
    const data = new Uint8Array(pixelData);
    socketRef.current!.emit('e131Data', data);
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
    sendE131Data(canvasRef.current!);
    if (selectedFrameIndex !== null) {
      updateSelectedFrame();
    }
  };
  const handleBrightnessChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setBrightness(parseFloat(event.target.value));
    sendE131Data(canvasRef.current!);
  };

  const handleGammaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGamma(parseFloat(event.target.value));
    sendE131Data(canvasRef.current!);
  };

  const handleRedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRGBAdjustment([parseFloat(event.target.value), RGBAdjustment[1], RGBAdjustment[2]]);
    sendE131Data(canvasRef.current!);
  };

  const handleGreenChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRGBAdjustment([RGBAdjustment[0], parseFloat(event.target.value), RGBAdjustment[2]]);
    sendE131Data(canvasRef.current!);
  };

  const handleBlueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRGBAdjustment([RGBAdjustment[0], RGBAdjustment[1], parseFloat(event.target.value)]);
    sendE131Data(canvasRef.current!);
  };

  const drawPixel = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * Constants.PIXEL_SIZE, y * Constants.PIXEL_SIZE, Constants.PIXEL_SIZE, Constants.PIXEL_SIZE);
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const pixelX = Math.floor(x / Constants.PIXEL_SIZE);
    const pixelY = Math.floor(y / Constants.PIXEL_SIZE);

    drawPixel(ctx, pixelX, pixelY, color);
  };

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(Constants.SOCKET_SERVER_URL);

    // Initialize canvas
    const canvas = canvasRef.current!;
    canvas.width = Constants.CANVAS_WIDTH;
    canvas.height = Constants.CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, Constants.CANVAS_WIDTH, Constants.CANVAS_HEIGHT);

    // Clean up on unmount
    return () => {
      socketRef.current!.disconnect();
    };
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      const currentFrame = savedFrames[selectedFrameIndex]!;
      // extract to method
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      if (currentFrame) {
        ctx.putImageData(currentFrame, 0, 0);
      }
      else {
        setSelectedFrameIndex(0)
        ctx.putImageData(savedFrames[0], 0, 0);
      }
      sendE131Data(animationCanvasRef.current!);
    }
  }, [savedFrames, selectedFrameIndex]);

  useEffect(() => {
    const intervalId = animateFrames();

    // Cleanup on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId); // Use clearInterval to stop the animation
      }
    };
  }, [savedFrames, frameRate, broadcastAnimation]);

  const handleColorChange = (newColor: { hex: string }) => {
    setColor(newColor.hex);
  };

  return (
    <div className="app-container">
      <div className="tool-content">
        <div>
          <SketchPicker color={color} onChange={handleColorChange} />
          <div style={{display: "grid"}}>
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
            <span style={{display:"inline-flex"}}>
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
              <p>{gamma}</p>
            </span>
            <span style={{display:"inline-flex"}}>
              <label>
                Red Correction:
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.01"
                  value={RGBAdjustment[0]}
                  onChange={handleRedChange}
                />
              </label>
              <p>{RGBAdjustment[0]}</p>
            </span>
            <span style={{display:"inline-flex"}}>
              <label>
                Green Correction:
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.01"
                  value={RGBAdjustment[1]}
                  onChange={handleGreenChange}
                />
              </label>
              <p>{RGBAdjustment[1]}</p>
            </span>
            <span style={{display:"inline-flex"}}>
              <label>
                Blue Correction:
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.01"
                  value={RGBAdjustment[2]}
                  onChange={handleBlueChange}
                />
              </label>
              <p>{RGBAdjustment[2]}</p>
            </span>
          </div>
          <label style={{fontSize: '12pt', padding: '2px', cursor: 'pointer', borderRadius: '2px', border: '1px solid black', backgroundColor: 'white' }}>
            Upload Image:
            <input style={{display: 'none'}} type="file" accept="image/png, image/jpeg" onChange={handleImageUpload} />
          </label>
        </div>
      </div>
      <div className="animation-container">
        <div className='scaled-animation-container'>
          <div className="animation-content">
            <canvas ref={animationCanvasRef} width={Constants.CANVAS_WIDTH} height={Constants.CANVAS_HEIGHT}></canvas>
          </div>
        </div>
        <label>
          Frame rate: {frameRate} fps
          <input
            type="range"
            min="1"
            max="60"
            value={frameRate}
            onChange={(e) => setFrameRate(Number(e.target.value))}
          />
      </label>
      <div className= { !broadcastAnimation ? 'button-container' : 'button-container button-container-selected'}>
        <button onClick={() => setBroadcastAnimation(!broadcastAnimation)}>Broadcast Animation</button>
      </div>
      </div>
      <div className="main-content">
        <div className="canvas-container">
          <canvas 
            id="drawingCanvas"
            ref={canvasRef} 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{cursor: `url(${pencilImg}) 0 24, auto`}}
          />
        </div>
        <div className="button-container">
          <button onClick={saveCurrentFrame}>Add New Frame</button>
          <button onClick={duplicateCurrentFrame}>Duplicate Frame</button>
          <button onClick={updateSelectedFrame}>Update Selected Frame</button>
          <button onClick={() => sendE131Data(canvasRef.current!)} style={{display: 'flex',  justifyContent: 'center', cursor: 'pointer'}}>Send</button>
          <button onClick={undoFrames}>Undo</button>
        </div>
      </div>
      <div className="frame-container">
          <h3>Frames</h3>
          <FrameList 
            savedFrames={savedFrames} 
            selectedFrameIndex={selectedFrameIndex}
            displayFrame={displayFrame}
            deleteFrame={deleteFrame}
            onReorder={(reorderedFrames) => setSavedFrames(() => reorderedFrames)} // assuming `setSavedFrames` is the useState setter
          />
      </div>
    </div>
  );
};

export default App;
