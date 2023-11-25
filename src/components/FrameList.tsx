import { FunctionComponent } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";

interface FrameListProps {
  savedFrames: ImageData[];
  selectedFrameIndex: number;
  displayFrame: (frameData: ImageData, index: number) => void;
  deleteFrame: (index: number) => void;
  onReorder: (reorderedFrames: ImageData[]) => void;
}

const FrameList: FunctionComponent<FrameListProps> = ({
  savedFrames,
  selectedFrameIndex,
  displayFrame,
  deleteFrame,
  onReorder,
}) => {
  const moveUp = (index: number) => {
    if (index === 0) return; // Already at the top

    const reorderedFrames = Array.from(savedFrames);
    const [removed] = reorderedFrames.splice(index, 1);
    reorderedFrames.splice(index - 1, 0, removed);

    onReorder(reorderedFrames);
  };

  const moveDown = (index: number) => {
    if (index === savedFrames.length - 1) return; // Already at the bottom

    const reorderedFrames = Array.from(savedFrames);
    const [removed] = reorderedFrames.splice(index, 1);
    reorderedFrames.splice(index + 1, 0, removed);

    onReorder(reorderedFrames);
  };

  return (
    <div>
      {savedFrames.map((frameData, index) => (
        <div
          className={`frame-preview ${
            index === selectedFrameIndex ? "selected-frame" : ""
          }`}
          key={index}
        >
          <div className="scaled-container">
            <canvas
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              ref={(el) =>
                el && el.getContext("2d")?.putImageData(frameData, 0, 0)
              }
              onClick={() => displayFrame(frameData, index)}
            />
          </div>
          <div className="button-container-frame">
            <button
              onClick={() => deleteFrame(index)}
              disabled={savedFrames.length < 2}
            >
              X
            </button>
            <button onClick={() => moveUp(index)} disabled={index === 0}>
              ↑
            </button>
            <button
              onClick={() => moveDown(index)}
              disabled={index === savedFrames.length - 1}
            >
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FrameList;
