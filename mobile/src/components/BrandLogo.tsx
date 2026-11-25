import React from "react";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

interface BrandLogoProps {
  size?: number;
}

export default function BrandLogo({ size = 36 }: BrandLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <Defs>
        <LinearGradient id="clMobBg" x1="12" y1="8" x2="116" y2="120" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#228161" />
          <Stop offset="100%" stopColor="#14563F" />
        </LinearGradient>
        <LinearGradient id="clMobSeal" x1="74" y1="52" x2="96" y2="76" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#F29F4B" />
          <Stop offset="100%" stopColor="#C86A1E" />
        </LinearGradient>
      </Defs>
      <Rect x="4" y="4" width="120" height="120" rx="28" fill="url(#clMobBg)" />
      <Rect
        x="6"
        y="6"
        width="116"
        height="116"
        rx="26"
        stroke="#FFFFFF"
        strokeOpacity={0.16}
        strokeWidth={2}
      />
      <Path
        d="M32 34H96C101.523 34 106 38.4772 106 44V58C102.686 58 100 60.6863 100 64C100 67.3137 102.686 70 106 70V84C106 89.5228 101.523 94 96 94H32C26.4772 94 22 89.5228 22 84V70C25.3137 70 28 67.3137 28 64C28 60.6863 25.3137 58 22 58V44C22 38.4772 26.4772 34 32 34Z"
        fill="#FAF7F2"
      />
      <Rect x="34" y="47" width="26" height="7" rx="3.5" fill="#1B6B50" />
      <Rect
        x="34"
        y="60.5"
        width="21"
        height="7"
        rx="3.5"
        fill="#1B6B50"
        fillOpacity={0.72}
      />
      <Rect x="34" y="74" width="15" height="7" rx="3.5" fill="#D47424" />
      <Line
        x1="67"
        y1="43"
        x2="67"
        y2="85"
        stroke="#DDD3C4"
        strokeWidth={2.5}
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      <Circle cx="84" cy="64" r="11.5" fill="url(#clMobSeal)" />
      <Path
        d="M78.8 64.2L82.3 67.7L89.4 60.4"
        stroke="#FAF7F2"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
