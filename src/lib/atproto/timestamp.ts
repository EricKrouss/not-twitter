export class Timestamp {
  constructor(private readonly date: Date) {}

  static now(): Timestamp {
    return new Timestamp(new Date());
  }

  static fromDate(date: Date): Timestamp {
    return new Timestamp(date);
  }

  toDate(): Date {
    return this.date;
  }
}
