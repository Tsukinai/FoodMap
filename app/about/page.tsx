import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '关于 — 食迹',
}

export default function AboutPage() {
  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--fm-paper)' }}>
      <div className="max-w-[560px] mx-auto px-8 py-14">

        <Link
          href="/"
          className="about-back-link inline-block text-sm"
          style={{ fontFamily: 'var(--font-geist-mono)' }}
        >
          ← 回地图
        </Link>

        <h1
          className="mt-10 mb-12 text-5xl leading-tight"
          style={{ fontFamily: 'var(--font-instrument-serif)', color: 'var(--fm-ink)', fontStyle: 'italic' }}
        >
          食迹
        </h1>

        <div className="space-y-5 text-[15px] leading-[1.85]" style={{ color: 'var(--fm-ink-2)' }}>
          <p>在新加坡吃了很多顿饭，但有一个很真实的问题</p>
          <p>我经常吃完就忘，名字忘，店也忘，只剩下"好像很好吃"这种模糊的幸福感</p>
          <p>
            有时候朋友问我推荐，我只能沉默三秒，说一句<br />
            "有一家很好吃，但我不记得叫什么了"
          </p>
          <p>
            于是就做了这个东西<br />
            一半是备忘录，一半是吃货的数据库<br />
            记录吃过的，也记录想吃的<br />
            毕竟刷到好店的时候不记下来，周末就只会站在街头发呆
          </p>
          <p>
            顺便还能按菜系、口味快速筛一筛<br />
            让"等下吃什么"这件事，稍微没那么痛苦一点
          </p>
          <p>说到底，就是想把零散的"想吃"和"吃过"，变成一个有用的清单</p>
        </div>

        <div className="my-12 text-center text-lg" style={{ color: 'var(--fm-line-2)', letterSpacing: '0.3em' }}>
          ⸻
        </div>

        <h2 className="text-base font-semibold mb-6" style={{ color: 'var(--fm-ink)' }}>
          我的口味
        </h2>

        <div className="space-y-5 text-[15px] leading-[1.85]" style={{ color: 'var(--fm-ink-2)' }}>
          <p>
            我是那种很典型的肉食动物<br />
            看到肉会开心，看到辣会更开心
          </p>
          <p>能吃辣，而且是那种越吃越上头的类型</p>
          <p>
            不太能接受小葱、姜、洋葱<br />
            但甜品可以非常双标，越甜越快乐
          </p>
          <p>
            披萨这件事上，我的态度比较极端<br />
            我属于意大利原教旨主义那一派<br />
            不能接受菠萝、青椒、洋葱这些东西出现在披萨上<br />
            看到会产生一点点情绪
          </p>
          <p>
            平时下班或者周末，很喜欢出去探店<br />
            偶尔也会自己做饭，顺便调点酒，假装生活很精致
          </p>
        </div>

        <div className="mt-16 pt-8 text-[13px] leading-relaxed" style={{ borderTop: '1px solid var(--fm-line)', color: 'var(--fm-ink-3)' }}>
          <p>
            这个项目开源在{' '}
            <a
              href="https://github.com/Tsukinai/FoodMap"
              target="_blank"
              rel="noopener noreferrer"
              className="about-back-link"
              style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}
            >
              GitHub
            </a>
            {' '}，欢迎来玩
          </p>
          <p className="mt-2" style={{ color: 'var(--fm-ink-4)' }}>
            提 issue 推荐餐馆、找 bug、或者赞助作者吃饭都行（笑
          </p>
          <p className="mt-2">
            联系我：{' '}
            <a
              href="mailto:shinomiyatsukinai@gmail.com"
              className="about-back-link"
              style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}
            >
              shinomiyatsukinai@gmail.com
            </a>
          </p>
        </div>

        <div className="mt-8 text-xs" style={{ color: 'var(--fm-ink-4)', fontFamily: 'var(--font-geist-mono)' }}>
          食迹 · 新加坡
        </div>

      </div>
    </div>
  )
}
