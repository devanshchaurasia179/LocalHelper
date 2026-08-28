import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  TextStyle,
  StyleProp,
} from 'react-native';
import { fonts } from './theme';

interface RotatingTextProps {
  /** Phrases shown one at a time, sliding in and out like a carousel. */
  items: string[];
  /** How long each phrase stays fully visible (ms). Default 2200. */
  holdDuration?: number;
  /** Slide + fade transition duration (ms). Default 500. */
  transitionDuration?: number;
  color?: string;
  fontSize?: number;
  /** Optional style override applied to the animated text (e.g. the hero tagline). */
  textStyle?: StyleProp<TextStyle>;
  /** How many lines each phrase may span. Default 1. */
  numberOfLines?: number;
  /** Horizontal alignment of the text block. Default 'center'. */
  align?: 'flex-start' | 'center' | 'flex-end';
}

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * A rotating text carousel: the current phrase slides out to the left while
 * the next phrase slides in from the right, one phrase at a time. Mirrors the
 * feel of a swiping carousel but for a single line of text.
 */
export default function RotatingText({
  items,
  holdDuration = 2200,
  transitionDuration = 500,
  color = 'rgba(255,255,255,0.92)',
  fontSize = 13,
  textStyle,
  numberOfLines = 1,
  align = 'center',
}: RotatingTextProps) {
  const [index, setIndex] = useState(0);
  // translateX drives the slide; opacity fades for a smoother swap.
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateToNext = useCallback(() => {
    // Slide current phrase out to the left + fade out
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -SCREEN_W * 0.35,
        duration: transitionDuration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: transitionDuration,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Advance to next phrase, then reposition off-screen right
      setIndex((prev) => (prev + 1) % items.length);
      translateX.setValue(SCREEN_W * 0.35);
      // Slide new phrase in from the right + fade in
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: transitionDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: transitionDuration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [items.length, transitionDuration, translateX, opacity]);

  useEffect(() => {
    if (items.length <= 1) return;
    timeoutRef.current = setInterval(animateToNext, holdDuration + transitionDuration * 2);
    return () => {
      if (timeoutRef.current) clearInterval(timeoutRef.current);
    };
  }, [items.length, holdDuration, transitionDuration, animateToNext]);

  if (!items.length) return null;

  const textAlign: TextStyle['textAlign'] =
    align === 'flex-start' ? 'left' : align === 'flex-end' ? 'right' : 'center';

  return (
    <View style={[styles.viewport, { alignItems: align }]} pointerEvents="none">
      <Animated.Text
        numberOfLines={numberOfLines}
        style={[
          styles.text,
          { color, fontSize, textAlign },
          textStyle,
          { opacity, transform: [{ translateX }] },
        ]}
      >
        {items[index]}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fonts.jostMedium,
    letterSpacing: 0.4,
  },
});
