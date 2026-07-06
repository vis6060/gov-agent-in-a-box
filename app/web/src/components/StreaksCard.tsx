import React from "react";

type ReviewerStreak = {
  reviewer: string;
  streak_days: number;
  active_days_in_window: number;
};

type Props = {
  reviewers: ReviewerStreak[];
};

export default function StreaksCard({ reviewers }: Props) {
  return (
    <div className="border rounded-xl p-4 shadow-sm bg-white">
      <div className="font-semibold mb-2">Reviewer streaks (30-day window)</div>
      {reviewers.length === 0 ? (
        <div className="text-sm text-gray-500">No approvals yet.</div>
      ) : (
        <ul className="text-sm">
          {reviewers.slice(0, 8).map((r) => (
            <li key={r.reviewer} className="flex justify-between py-1">
              <span>{r.reviewer}</span>
              <span className="font-mono">
                {r.streak_days} day{r.streak_days === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
