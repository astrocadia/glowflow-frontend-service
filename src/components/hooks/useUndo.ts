import { useState, useCallback } from 'react';

// Custom hook to manage undo functionality
const useUndo = <T>(initialState: T) => {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory(prevHistory => {
      // If we've undid anything, truncate the redo's
      const truncatedHistory = prevHistory.slice(0, currentIndex + 1);
      
      const nextData = typeof newState === 'function'
        ? (newState as Function)(truncatedHistory[currentIndex])
        : newState;

      // Limit to 20 undos by removing the oldest state if necessary
      const newHistory = truncatedHistory.length >= 20
        ? [...truncatedHistory.slice(1), nextData]
        : [...truncatedHistory, nextData];
      
      return newHistory;
    });
    setCurrentIndex(prevIndex => Math.min(prevIndex + 1, 19)); // Ensure we don't exceed index 19
  }, [currentIndex]);

  const undo = useCallback(() => {
    setCurrentIndex(prevIndex => Math.max(prevIndex - 1, 0));
  }, []);

  return [history[currentIndex], setState, undo] as const;
};

export default useUndo;
