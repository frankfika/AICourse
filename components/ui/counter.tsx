'use client'

import { motion, useSpring, useTransform, useInView } from 'framer-motion'
import { useEffect, useRef } from 'react'

export function Counter({ value, duration = 2 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  
  const spring = useSpring(0, {
    mass: 1,
    stiffness: 50,
    damping: 20,
    duration: duration * 1000
  })
  
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString())
  
  useEffect(() => {
    if (inView) {
      spring.set(value)
    }
  }, [inView, spring, value])
  
  return <motion.span ref={ref}>{display}</motion.span>
}
