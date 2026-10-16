#import <AppKit/AppKit.h>
#include <node_api.h>
#include "scroll-source-core.h"

namespace {
scroll_source::Ring samples;
id monitor = nil;
double epochNow() { return NSDate.date.timeIntervalSince1970 * 1000.0; }
void stop(void*) {
  if (monitor) { [NSEvent removeMonitor:monitor]; monitor = nil; }
}
napi_value start(napi_env env, napi_callback_info) {
  if (!NSThread.isMainThread) {
    napi_throw_error(env, nullptr, "Native scroll monitoring requires the main thread");
    return nullptr;
  }
  if (!monitor) {
    monitor = [NSEvent addLocalMonitorForEventsMatchingMask:NSEventMaskScrollWheel
      handler:^NSEvent*(NSEvent* event) {
        // App-local only: no event tap, global monitoring or accessibility grant.
        const double epoch = epochNow() - NSProcessInfo.processInfo.systemUptime * 1000.0
                             + event.timestamp * 1000.0;
        samples.add(epoch, event.windowNumber, event.hasPreciseScrollingDeltas,
                    event.phase, event.momentumPhase);
        return event;
      }];
  }
  napi_value result;
  napi_get_boolean(env, monitor != nil, &result);
  return result;
}
napi_value source(napi_env env, napi_callback_info info) {
  size_t count = 2; napi_value args[2];
  napi_get_cb_info(env, info, &count, args, nullptr, nullptr);
  double epoch = 0; bool isBuffer = false; void* pointer = nullptr; size_t bytes = 0;
  napi_value unknown; napi_get_null(env, &unknown);
  if (count != 2 || napi_get_value_double(env, args[0], &epoch) != napi_ok ||
      napi_is_buffer(env, args[1], &isBuffer) != napi_ok || !isBuffer ||
      napi_get_buffer_info(env, args[1], &pointer, &bytes) != napi_ok ||
      bytes != sizeof(void*)) return unknown;
  // The main process supplies BrowserWindow.getNativeWindowHandle (NSView*).
  // No renderer-provided pointer or arbitrary native operation is accepted.
  NSView* view = (__bridge NSView*)*reinterpret_cast<void**>(pointer);
  if (!view || !view.window) return unknown;
  const int kind = samples.match(epoch, view.window.windowNumber, epochNow());
  if (kind < 0) return unknown;
  napi_value result;
  napi_create_string_utf8(env, kind == 1 ? "gesture" : "wheel", NAPI_AUTO_LENGTH, &result);
  return result;
}
napi_value init(napi_env env, napi_value exports) {
  napi_property_descriptor properties[] = {
    {"start", nullptr, start, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"source", nullptr, source, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  napi_define_properties(env, exports, 2, properties);
  napi_add_env_cleanup_hook(env, stop, nullptr);
  return exports;
}
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
