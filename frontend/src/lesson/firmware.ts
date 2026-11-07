/** 第一课默认程序：XIAO ESP32-S3 + DHT22(D0) + 有源蜂鸣器(D1)。与 firstLesson 连线图一致。 */
export const FIRST_LESSON_CODE = `#include <DHT.h>

// 连线（见「连线图」）：DHT22 DATA -> D0 (GPIO1)，蜂鸣器 S -> D1 (GPIO2)
#define DHT_PIN 1
#define DHT_TYPE DHT22
#define BUZZER_PIN 2

DHT dht(DHT_PIN, DHT_TYPE);

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  dht.begin();
  Serial.println("MakeFast first lesson ready");
}

void loop() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  Serial.print("Temp: ");
  Serial.print(temperature);
  Serial.print(" C, Humidity: ");
  Serial.print(humidity);
  Serial.println(" %");

  if (temperature > 30) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(BUZZER_PIN, LOW);
  }

  delay(2000);
}
`;
