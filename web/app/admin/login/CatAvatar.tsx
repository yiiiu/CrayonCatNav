import Image from "next/image";
import styles from "./login.module.css";

/**
 * 登录页头像：位图蜡笔猫 + 对齐眼睛的手绘闭眼层。
 * 闭眼由 CSS 切换（.loginCard 内密码框获得焦点时），无需 JS；坐标基于 cat-logo.png 的 512×512 画布，
 * 眼白实测范围：左 x164–247 / y174–254，右 x268–352 / y169–253。
 */
export function CatAvatar() {
  return (
    <span className={styles.avatar}>
      <Image className={styles.avatarImg} src="/cat-logo.png" alt="蜡笔猫标志：拿着咖啡杯的蓝色小猫" width={104} height={104} priority />
      <svg className={styles.lids} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
        <defs>
          {/* 毛边 + 少量白色蜡笔颗粒，贴合原图的油画棒质感 */}
          <filter id="cat-lid-crayon" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={2} seed={11} result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale={9} xChannelSelector="R" yChannelSelector="G" result="d" />
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} result="grain" />
            <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.85  0 0 0 0 0.92  0 0 0 0 1  4 0 0 0 -2.75" result="speck" />
            <feComposite in="speck" in2="d" operator="in" result="speckIn" />
            <feBlend in="speckIn" in2="d" mode="screen" />
          </filter>
          <filter id="cat-lid-line" x="-20%" y="-50%" width="140%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves={2} seed={5} />
            <feDisplacementMap in="SourceGraphic" scale={5} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g className={styles.lid} filter="url(#cat-lid-crayon)">
          <ellipse cx="205" cy="213" rx="53" ry="51" fill="#3a80d9" />
        </g>
        <g className={styles.lid} filter="url(#cat-lid-crayon)">
          <ellipse cx="310" cy="211" rx="53" ry="53" fill="#3a80d9" />
        </g>
        <g className={styles.lash} fill="none" stroke="#1d1a1f" strokeLinecap="round" filter="url(#cat-lid-line)">
          <path d="M168 214 Q205 246 244 212" strokeWidth="8" />
          <path d="M176 230 l-8 10 M205 240 l0 12 M232 230 l8 10" strokeWidth="5" />
          <path d="M272 212 Q310 246 349 210" strokeWidth="8" />
          <path d="M280 229 l-8 10 M310 239 l0 12 M339 228 l8 10" strokeWidth="5" />
        </g>
      </svg>
    </span>
  );
}
