import React from 'react';
import axios from 'axios';

const url: string = 'http://192.168.1.24/setMatrix'
interface ButtonProps {
    data: string;
}

const Button: React.FC<ButtonProps> = ( { data } ) => {
    const handleClick = async (event: React.ChangeEvent<HTMLInputElement>) => {
        await axios.post(url, data);
    };

  return (
    <button onClick={handleClick}>Post</button>
  );
};

export default Button;