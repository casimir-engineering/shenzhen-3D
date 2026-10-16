#pragma once
#include <array>
#include <cmath>
#include <cstdint>

namespace scroll_source {
struct Sample {
  double epochMs = 0;
  int64_t window = 0;
  bool gesture = false;
};
class Ring {
 public:
  void add(double epochMs, int64_t window, bool precise, uint64_t phase,
           uint64_t momentum) {
    samples_[next_++ % samples_.size()] =
        {epochMs, window, precise && (phase != 0 || momentum != 0)};
  }
  // Return -1 for unknown, 0 for wheel, 1 for an AppKit fluid scroll gesture.
  int match(double epochMs, int64_t window, double nowMs) const {
    if (!std::isfinite(epochMs) || epochMs > nowMs + 20 || nowMs - epochMs > 2000)
      return -1;
    double best = 12.0;
    int result = -1;
    bool ambiguous = false;
    for (const auto& sample : samples_) {
      const double difference = std::abs(sample.epochMs - epochMs);
      if (sample.epochMs <= 0 || sample.window != window || difference > 12.0) continue;
      const int kind = sample.gesture ? 1 : 0;
      if (difference < best - 0.000001 || result == -1) {
        best = difference;
        result = kind;
        ambiguous = false;
      } else if (std::abs(difference - best) <= 0.000001 && kind != result) {
        ambiguous = true;
      }
    }
    return ambiguous ? -1 : result;
  }
 private:
  std::array<Sample, 128> samples_{};
  uint64_t next_ = 0;
};
}  // namespace scroll_source
