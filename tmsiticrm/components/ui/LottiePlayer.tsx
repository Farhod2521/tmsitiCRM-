"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

interface LottiePlayerProps {
  src: string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export default function LottiePlayer({
  src,
  width = 300,
  height = 300,
  className,
}: LottiePlayerProps) {
  return (
    <DotLottieReact
      src={src}
      loop
      autoplay
      style={{ width, height }}
      className={className}
    />
  );
}
