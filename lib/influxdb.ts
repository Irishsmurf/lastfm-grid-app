import { InfluxDB, Point, WriteApi } from '@influxdata/influxdb-client';

let writeApi: WriteApi | undefined;

// Check if we are on the server side and if the required env vars are present
if (
  typeof window === 'undefined' &&
  process.env.INFLUX_URL &&
  process.env.INFLUX_TOKEN
) {
  const influxDB = new InfluxDB({
    url: process.env.INFLUX_URL,
    token: process.env.INFLUX_TOKEN,
  });

  writeApi = influxDB.getWriteApi(
    process.env.INFLUX_ORG!,
    process.env.INFLUX_BUCKET!
  );

  // Gracefully close the writer when the process exits
  process.on('beforeExit', async () => {
    try {
      if (writeApi) {
        await writeApi.close();
        console.log('InfluxDB writeApi closed.');
      }
    } catch (e) {
      console.error('Error closing InfluxDB writeApi', e);
    }
  });
}

export const writePoint = (
  measurement: string,
  tags: { [key: string]: string },
  fields: { [key: string]: string | number | boolean }
) => {
  // Only write the point if the writeApi is initialized (i.e., on the server)
  if (!writeApi) {
    return;
  }

  const point = new Point(measurement);

  for (const key in tags) {
    point.tag(key, tags[key]);
  }

  for (const key in fields) {
    const value = fields[key];
    if (typeof value === 'boolean') {
      point.booleanField(key, value);
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        point.intField(key, value);
      } else {
        point.floatField(key, value);
      }
    } else {
      point.stringField(key, String(value));
    }
  }

  writeApi.writePoint(point);
};
