# 环境音采样授权说明

应用内置的环境音采样来自 Wikimedia Commons，按下列许可随应用分发。
合成引擎仅作为对应采样缺失时的兜底，不涉及第三方素材。

| 文件 | 原始文件 | 许可 | 作者 |
|---|---|---|---|
| `public/sounds/rain.ogg` | Rain against the window.ogg | Public Domain | cori |
| `public/sounds/waves.ogg` | Oceanwavescrushing.ogg | CC BY 3.0 | Luftrum |
| `public/sounds/wind.ogg` | Wind in Swedish pine forest at 25 mps.ogg | CC BY-SA 4.0 | W.carter |
| `public/sounds/fire.ogg` | WWS Fireoftheforge.ogg | CC BY 4.0 | Work With Sounds / La Fonderie |
| `public/sounds/white.ogg` | Whitenoisesound.ogg | Public Domain | （佚名） |

来源链接格式：`https://commons.wikimedia.org/wiki/<原始文件名>`

> 「夜城」暂无合适采样，由程序合成生成。
> 音乐功能已移除网易云第三方代理（侵权风险），如需恢复请使用用户自有本地文件或注册官方 Jamendo API。

## 替换/新增采样

把任意 OGG/MP3 放入 `public/sounds/` 并命名为对应 id（`rain/waves/wind/fire/night/white`），
应用会优先加载采样文件；加载失败自动回退到内置合成引擎。
