import type { AudiencePreviewResponse } from "../types/audience";

interface AudienceResultsProps {
  result: AudiencePreviewResponse;
}

export function AudienceResults({ result }: AudienceResultsProps) {
  if (result.total === 0) {
    return (
      <section aria-live="polite">
        <h2
          id="results-heading"
          tabIndex={-1}
          className="mb-3 text-lg font-bold text-text-primary outline-none"
        >
          Preview Results
        </h2>
        <p className="text-sm text-text-secondary">
          No users match these conditions for{" "}
          <strong className="font-semibold">{result.name}</strong>.
        </p>
      </section>
    );
  }

  const eventTypes = result.members[0]?.evidence.map((e) => e.eventType) ?? [];

  return (
    <section aria-live="polite" className="flex flex-col gap-4">
      <h2
        id="results-heading"
        tabIndex={-1}
        className="text-lg font-bold text-text-primary outline-none"
      >
        Preview Results
      </h2>

      {/* Summary */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-secondary">
        <p>
          Audience:{" "}
          <strong className="font-semibold text-text-primary">
            {result.name}
          </strong>
        </p>
        <p>
          Matched users:{" "}
          <strong className="text-base font-bold text-success">
            {result.total}
          </strong>
        </p>
        <p className="w-full text-xs text-text-hint">
          Evaluated as of {new Date(result.asOf).toUTCString()}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table
          className="w-full border-collapse text-sm"
          aria-label={`${result.total} audience members`}
        >
          <thead>
            <tr className="bg-surface-alt">
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Anonymous ID
              </th>
              {eventTypes.map((eventType) => (
                <th
                  key={eventType}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
                >
                  {eventType.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.members.map((member, i) => (
              <tr
                key={member.anonymousId}
                className={`border-t border-border transitions hover:bg-surface-alt ${i === result.members.length - 1 ? "border-b-0" : ""}`}
              >
                <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                  {member.anonymousId}
                </td>
                {member.evidence.map((item) => (
                  <td
                    key={item.eventType}
                    aria-label={`${item.eventType}: ${item.observedCount}`}
                    className={`px-4 py-3 font-mono font-semibold ${
                      item.observedCount === 0
                        ? "text-count-zero"
                        : "text-count-nonzero"
                    }`}
                  >
                    {item.observedCount}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
