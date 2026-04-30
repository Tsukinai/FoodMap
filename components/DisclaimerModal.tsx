'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'foodmap-disclaimer-v1'

export default function DisclaimerModal() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(31,28,24,0.45)', backdropFilter: 'blur(3px)' }}
    >
      <div
        className="relative mx-4 w-full max-w-md rounded-2xl p-8 flex flex-col gap-5"
        style={{
          background: 'var(--fm-paper)',
          border: '1px solid var(--fm-line)',
          boxShadow: '0 8px 40px rgba(31,28,24,0.18)',
        }}
      >
        <div>
          <h2
            className="text-2xl mb-1"
            style={{ fontFamily: 'var(--font-instrument-serif)', color: 'var(--fm-ink)' }}
          >
            嗨，先说在前头
          </h2>
          <p className="text-xs" style={{ color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)' }}>
            进来之前，有几件事得讲清楚
          </p>
        </div>

        <ul className="flex flex-col gap-3 text-sm" style={{ color: 'var(--fm-ink-2)' }}>
          <li className="flex gap-3">
            <span style={{ color: 'var(--fm-orange)', flexShrink: 0 }}>01</span>
            <span>这里只记录我本人真正吃过的地方，以及想要吃的地方，全凭个人喜好，只能由我自己自定义地图钉哦。🥺</span>
          </li>
          <li className="flex gap-3">
            <span style={{ color: 'var(--fm-orange)', flexShrink: 0 }}>02</span>
            <span>所有评价都是主观的，代表我那一天、那一口的感受。你的口味可能跟我差十万八千里，这很正常。😋</span>
          </li>
          <li className="flex gap-3">
            <span style={{ color: 'var(--fm-orange)', flexShrink: 0 }}>03</span>
            <span>
              有好料藏着掖着？去{' '}
              <span style={{ color: 'var(--fm-green)', fontWeight: 600 }}>留言板</span>{' '}
              推荐给我，说不定下周就出现在地图上了。🤩
            </span>
          </li>
          <li className="flex gap-3">
            <span style={{ color: 'var(--fm-orange)', flexShrink: 0 }}>04</span>
            <span>
              代码开源在{' '}
              <a
                href="https://github.com/Tsukinai/FoodMap"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--fm-ink)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
              >
                GitHub
              </a>
              ，随便看，随便 fork，随便提 issue，想要做一个自己的美食地图的话，可以参考一下。
            </span>
          </li>
        </ul>

        <button
          onClick={dismiss}
          className="mt-1 w-full rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{
            background: 'var(--fm-ink)',
            color: 'var(--fm-paper)',
            fontFamily: 'var(--font-geist-mono)',
          }}
        >
          好的，开吃
        </button>
      </div>
    </div>
  )
}
