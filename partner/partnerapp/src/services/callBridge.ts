/**
 * callBridge — Partner App
 *
 * A tiny synchronous event emitter that bridges CallKeep's native events
 * (which fire outside React, including when the app is woken from quit/background)
 * to the React world (useCallManager).
 *
 * We also buffer the most recent "answer" event: if the user answers on the
 * native lock-screen UI before React has mounted / subscribed, the event would
 * otherwise be lost. useCallManager drains the buffer once it subscribes.
 */

type CallBridgeEvent = 'answer' | 'end' | 'mute';

interface AnswerPayload {
  callId: string;
}
interface EndPayload {
  callId: string;
  wasRinging: boolean;
}
interface MutePayload {
  callId: string;
  muted: boolean;
}

type PayloadMap = {
  answer: AnswerPayload;
  end: EndPayload;
  mute: MutePayload;
};

type Handler<E extends CallBridgeEvent> = (payload: PayloadMap[E]) => void;

class CallBridge {
  private handlers: { [K in CallBridgeEvent]: Set<Handler<K>> } = {
    answer: new Set(),
    end: new Set(),
    mute: new Set(),
  };

  // Pending "answer" callId captured before any subscriber existed (cold start
  // from the native UI). Drained by consumePendingAnswer().
  private pendingAnswer: string | null = null;

  on<E extends CallBridgeEvent>(event: E, handler: Handler<E>): () => void {
    this.handlers[event].add(handler as Handler<any>);
    return () => {
      this.handlers[event].delete(handler as Handler<any>);
    };
  }

  emit<E extends CallBridgeEvent>(event: E, payload: PayloadMap[E]): void {
    if (event === 'answer' && this.handlers.answer.size === 0) {
      // No subscriber yet — remember so useCallManager can pick it up on mount.
      this.pendingAnswer = (payload as AnswerPayload).callId;
    }
    for (const handler of this.handlers[event]) {
      try {
        (handler as Handler<any>)(payload);
      } catch (err: any) {
        console.warn('[callBridge] handler error:', err?.message || err);
      }
    }
  }

  /** Returns and clears any answer captured before a subscriber existed. */
  consumePendingAnswer(): string | null {
    const id = this.pendingAnswer;
    this.pendingAnswer = null;
    return id;
  }
}

export const callBridge = new CallBridge();
