#include "scroll-source-core.h"
#include <cassert>
#include <limits>
int main() {
  scroll_source::Ring ring;
  ring.add(1000, 1, true, 1, 0);
  ring.add(1008, 1, true, 0, 0); // Smooth physical wheel, not a gesture.
  assert(ring.match(1000, 1, 1020) == 1);
  assert(ring.match(1008, 1, 1020) == 0);
  assert(ring.match(1004, 1, 1020) == -1); // Never choose by ring storage order.
  ring.add(1020, 1, true, 0, 2); // Momentum remains a gesture.
  assert(ring.match(1020, 1, 1030) == 1);
  ring.add(1040, 1, false, 1, 0);
  assert(ring.match(1040, 1, 1050) == 0);
  assert(ring.match(1020, 2, 1030) == -1);
  assert(ring.match(1060, 1, 1070) == -1);
  assert(ring.match(1020, 1, 4000) == -1);
  assert(ring.match(std::numeric_limits<double>::quiet_NaN(), 1, 1030) == -1);
  for (int i = 0; i < 129; i++) ring.add(2000 + i, 1, true, 1, 0);
  assert(ring.match(1040, 1, 2200) == -1);
}
