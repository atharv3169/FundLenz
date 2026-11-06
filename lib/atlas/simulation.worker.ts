import { simulate, type Model, type SimSpec } from './model';
self.onmessage = (event: MessageEvent<{ model: Model; spec: SimSpec }>) => {
  try {
    self.postMessage({ result: simulate(event.data.model, event.data.spec) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Invalid simulation.',
    });
  }
};
