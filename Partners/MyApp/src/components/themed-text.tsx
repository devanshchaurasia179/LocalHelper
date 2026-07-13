import { Text, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { ThemeColor } from '@/constants/theme';

type TextType =
  | 'default'
  | 'title'
  | 'subtitle'
  | 'small'
  | 'smallBold'
  | 'code'
  | 'link'
  | 'linkPrimary';

interface ThemedTextProps extends TextProps {
  type?: TextType;
  themeColor?: ThemeColor;
}

export function ThemedText({
  type = 'default',
  themeColor = 'text',
  style,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor] },
        styles[type],
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  code: {
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    textDecorationLine: 'underline',
  },
  linkPrimary: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
});
