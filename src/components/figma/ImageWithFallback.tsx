import React, { useState, useMemo } from 'react'
import { optimizeUnsplashUrl } from '../../utils/imageOptimization'

const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg=='

export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [didError, setDidError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const handleError = () => {
    setDidError(true)
  }

  const handleLoad = () => {
    setIsLoaded(true)
  }

  const { src, alt, style, className, loading, decoding, width, height, ...rest } = props

  // Optimize Unsplash URLs automatically
  const optimizedSrc = useMemo(() => {
    if (src && typeof src === 'string' && src.includes('unsplash.com')) {
      return optimizeUnsplashUrl(src, {
        width: width ? Number(width) : 800,
        height: height ? Number(height) : undefined,
        quality: 80,
        format: 'auto'
      });
    }
    return src;
  }, [src, width, height]);

  return didError ? (
    <div
      className={`inline-block bg-gray-100 text-center align-middle ${className ?? ''}`}
      style={style}
    >
      <div className="flex items-center justify-center w-full h-full">
        <img src={ERROR_IMG_SRC} alt="Error loading image" {...rest} data-original-url={src} />
      </div>
    </div>
  ) : (
    <img 
      src={optimizedSrc} 
      alt={alt} 
      className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}
      style={style} 
      width={width}
      height={height}
      loading={loading || 'lazy'}
      decoding={decoding || 'async'}
      {...rest} 
      onError={handleError}
      onLoad={handleLoad}
    />
  )
}
