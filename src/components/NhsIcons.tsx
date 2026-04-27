import React from 'react';

type IconProps = {
  size?: number;
  className?: string;
  color?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
};

export const NhsTick: React.FC<IconProps> = ({ size = 34, className, color = '#377C42', ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 34 34"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...rest}
  >
    <path
      d="M9 17.6L14.3 22.7L25 11.3"
      stroke={color}
      strokeWidth="5.6667"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const NhsCross: React.FC<IconProps> = ({ size = 34, className, color = '#C43A2A', ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 34 34"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...rest}
  >
    <path d="M10 10L24 24" stroke={color} strokeWidth="5.6667" strokeLinecap="round" />
    <path d="M24 10L10 24" stroke={color} strokeWidth="5.6667" strokeLinecap="round" />
  </svg>
);
