import React from 'react';

interface ColorPickerProps {
  color: string;
  setColor: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ color, setColor }) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setColor(event.target.value);
  };

  return (
    <input type="color" value={color} onChange={handleChange} />
  );
};

export default ColorPicker;