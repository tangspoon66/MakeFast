import { describe, expect, it } from 'vitest';
import { isCompleteSketch } from './AIAssistant';

describe('isCompleteSketch', () => {
  it('allows one-click deploy only for complete Arduino sketches', () => {
    expect(isCompleteSketch(`void setup() {
  pinMode(2, OUTPUT);
}

void loop() {
  digitalWrite(2, HIGH);
}`)).toBe(true);
  });

  it('does not treat partial snippets as deployable', () => {
    expect(isCompleteSketch('pinMode(2, OUTPUT);')).toBe(false);
    expect(isCompleteSketch(`void setup() {
  Serial.begin(115200);
}`)).toBe(false);
    expect(isCompleteSketch(`void loop() {
  delay(1000);
}`)).toBe(false);
  });
});
