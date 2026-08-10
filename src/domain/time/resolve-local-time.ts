import { Temporal } from "@js-temporal/polyfill";

export class InvalidLocalTimeError extends Error {
  constructor(
    readonly code: "TIME_INVALID" | "TIME_AMBIGUOUS",
    message: string,
  ) {
    super(message);
    this.name = "InvalidLocalTimeError";
  }
}

export interface ResolvedLocalTime {
  readonly localDateTime: string;
  readonly timeZone: string;
  readonly instant: string;
  readonly offset: string;
}

function parseLocal(date: string, time: string): Temporal.PlainDateTime {
  try {
    return Temporal.PlainDateTime.from(`${date}T${time}`);
  } catch {
    throw new InvalidLocalTimeError(
      "TIME_INVALID",
      "Enter a valid calendar date and time.",
    );
  }
}

export function resolveLocalTime(
  date: string,
  time: string,
  timeZone: string,
  disambiguation?: "earlier" | "later",
): ResolvedLocalTime {
  const plain = parseLocal(date, time);
  const fields = {
    timeZone,
    year: plain.year,
    month: plain.month,
    day: plain.day,
    hour: plain.hour,
    minute: plain.minute,
    second: plain.second,
  };

  let earlier: Temporal.ZonedDateTime;
  let later: Temporal.ZonedDateTime;
  try {
    earlier = Temporal.ZonedDateTime.from(fields, {
      disambiguation: "earlier",
    });
    later = Temporal.ZonedDateTime.from(fields, { disambiguation: "later" });
  } catch {
    throw new InvalidLocalTimeError(
      "TIME_INVALID",
      "Choose a valid IANA time zone.",
    );
  }

  if (
    !earlier.toPlainDateTime().equals(plain) ||
    !later.toPlainDateTime().equals(plain)
  ) {
    throw new InvalidLocalTimeError(
      "TIME_INVALID",
      "That local time does not exist because the clock changes. Choose another time.",
    );
  }

  const ambiguous = earlier.epochNanoseconds !== later.epochNanoseconds;
  if (ambiguous && disambiguation === undefined) {
    throw new InvalidLocalTimeError(
      "TIME_AMBIGUOUS",
      "That local time occurs twice. Choose the earlier or later occurrence.",
    );
  }

  const zoned = disambiguation === "later" ? later : earlier;
  const instant = zoned.toInstant();
  return {
    localDateTime: plain.toString({ smallestUnit: "minute" }),
    timeZone,
    instant: instant.toString(),
    offset: zoned.offset,
  };
}
