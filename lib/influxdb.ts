import { InfluxDB, Point } from '@influxdata/influxdb-client';

const influxDB = new InfluxDB({
  url: process.env.INFLUX_URL!,
  token: process.env.INFLUX_TOKEN!,
});

const writeApi = influxDB.getWriteApi(
  process.env.INFLUX_ORG!,
  process.env.INFLUX_BUCKET!
);

export const writePoint = (
  measurement: string,
  tags: { [key: string]: string },
  fields: { [key: string]: unknown }
) => {
  const point = new Point(measurement);

  for (const key in tags) {
    point.tag(key, tags[key]);
  }

  for (const key in fields) {
    const value = fields[key];
    if (typeof value === 'boolean') {
      point.booleanField(key, value);
    } else if (typeof value === 'number') {
      point.floatField(key, value);
    } else {
      point.stringField(key, String(value));
    }
  }

  writeApi.writePoint(point);
};
