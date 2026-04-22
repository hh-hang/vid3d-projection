<template>
    <div class="home">
        <header class="header">
            <h1 class="title">vid3d-projection</h1>
            <p class="subtitle">
                Three.js & Cesium.js的三维场景视频纹理投影工具
            </p>
        </header>
        <main class="examples">
            <a class="card" href="./three-monitor.html">
                <div class="badge badge-three">Three.js</div>
                <div class="card-image">
                    <img src="/imgs/2.gif" alt="Monitor" />
                </div>
                <div class="card-info">
                    <h2>监控</h2>
                    <p>Three 监控视频投影示例</p>
                    <span class="card-arrow">→</span>
                </div>
            </a>
            <a class="card" href="./three-cinema.html">
                <div class="badge badge-three">Three.js</div>
                <div class="card-image">
                    <img src="/imgs/1.gif" alt="Cinema" />
                </div>
                <div class="card-info">
                    <h2>影院</h2>
                    <p>影院场景视频投影示例</p>
                    <span class="card-arrow">→</span>
                </div>
            </a>
            <a class="card" href="./cesium-monitor.html">
                <div class="badge badge-cesium">Cesium.js</div>
                <div class="card-image">
                    <img src="/imgs/3.gif" alt="Cesium" />
                </div>
                <div class="card-info">
                    <h2>监控</h2>
                    <p>Cesium 监控视频投影示例</p>
                    <span class="card-arrow">→</span>
                </div>
            </a>
        </main>
    </div>
</template>

<style scoped>
.home {
    width: 100vw;
    min-height: 100vh;
    background: #0d0d0d;
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 48px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    padding: 40px 0;
    box-sizing: border-box;
}

.header {
    text-align: center;
}

.title {
    font-size: 2.4rem;
    font-weight: 700;
    margin: 0 0 10px;
    letter-spacing: 0.02em;
    background: linear-gradient(135deg, #fff 40%, #888);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.subtitle {
    margin: 0;
    color: #666;
    font-size: 0.95rem;
}

.examples {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    justify-content: center;
    padding: 0 16px;
}

.card {
    display: flex;
    flex-direction: column;
    width: 480px;
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    text-decoration: none;
    color: #fff;
    overflow: hidden;
    transition:
        border-color 0.2s,
        background 0.2s;
    position: relative;
}

.card:hover {
    background: #222;
    border-color: #444;
}

.badge {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #aaa;
}

.badge-three {
    color: #00aaff;
    border-color: rgba(0, 170, 255, 0.3);
}

.badge-cesium {
    color: #ff9900;
    border-color: rgba(255, 153, 0, 0.3);
}

.card-image {
    width: 100%;
    height: 300px;
    overflow: hidden;
    background: #111;
}

.card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.card-info {
    padding: 20px 24px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.card-info h2 {
    margin: 0 0 4px;
    font-size: 1.1rem;
    font-weight: 600;
}

.card-info p {
    margin: 0;
    font-size: 0.82rem;
    color: #666;
}

.card-arrow {
    margin-left: auto;
    font-size: 1.2rem;
    color: #444;
    transition:
        color 0.2s,
        transform 0.2s;
}

.card:hover .card-arrow {
    color: #aaa;
    transform: translateX(4px);
}

@media (max-width: 600px) {
    .home {
        gap: 32px;
        justify-content: flex-start;
        padding: 40px 0;
    }

    .title {
        font-size: 1.6rem;
    }

    .card {
        width: 100%;
    }

    .card-image {
        height: 200px;
    }
}
</style>
