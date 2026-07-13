import { View, ViewProps } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { ThemeColor } from '@/constants/theme';

type ViewType = 'default' | 'backgroundElement' | 'backgroundSelected';

interface ThemedViewProps extends ViewProps {
  type?: ViewType;
  themeColor?: ThemeColor;
}

const typeToColor: Record<ViewType, ThemeColor> = {
  default: 'background',
  backgroundElement: 'backgroundElement',
  backgroundSelected: 'backgroundSelected',
};

export function ThemedView({
  type = 'default',
  themeColor,
  style,
  ...rest
}: ThemedViewProps) {
  const theme = useTheme();
  const colorKey = themeColor ?? typeToColor[type];

  return (
    <View
      style={[{ backgroundColor: theme[colorKey] }, style]}
      {...rest}
    />
  );
}
