"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * 简易滚动容器：用原生 overflow 替代 @base-ui/react/scroll-area，
 * 使 @base-ui 不再进入首屏加载。
 * 视觉差异：使用浏览器默认滚动条（已获用户接受）。
 */
function ScrollArea({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("size-full overflow-y-auto", className)} {...props}>
      {children}
    </div>
  )
}

// 兼容占位：当前无调用方使用 ScrollBar
function ScrollBar({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("hidden", className)} {...props} />
}

export { ScrollArea, ScrollBar }
