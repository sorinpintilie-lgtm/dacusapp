import Svg, { Polyline } from 'react-native-svg';

type RoofMarkProps = {
  width: number;
  color: string;
  strokeWidth?: number;
  opacity?: number;
};

/** The roof line from the Dacus logo: a single chevron, used as a brand accent on dark cards. */
export function RoofMark({ width, color, strokeWidth = 7, opacity = 1 }: RoofMarkProps) {
  const height = width * 0.5;
  return (
    <Svg width={width} height={height} viewBox="0 0 100 50" opacity={opacity}>
      <Polyline
        points="4,47 50,6 96,47"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </Svg>
  );
}
