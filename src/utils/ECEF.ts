export interface Point {
    x: number;
    y: number;
}

export interface LLACoordinate {
    latitude: number;
    longitude: number;
    altitude: number;
}

export interface ECEFCoordinate {
    x: number;
    y: number;
    z: number;
}

export interface ENUParams {
    distance: number;
    azimuth: number;
    elevation: number;
}

export default class ECEF {
    readonly PI: number = 3.141592653589793238;
    readonly a: number = 6378137.0;
    readonly b: number = 6356752.3142;
    readonly f: number = (this.a - this.b) / this.a;
    readonly e_sq: number = this.f * (2.0 - this.f);
    readonly ee: number = 0.00669437999013;
    readonly WGSF: number = 1 / 298.257223563;
    readonly WGSe2: number = this.WGSF * (2 - this.WGSF);
    readonly WGSa: number = 6378137.0;
    readonly EPSILON: number = 1.0e-12;

    constructor() { }

    /**
     * 根据起始点、方位角、仰角、距离计算目标坐标
     */
    CalculateCoordinates(
        point: Point,
        azimuth: number,
        elevation: number,
        distance: number
    ): { lng: number; lat: number; height: number } {
        // 计算垂直高度（使用角度转为弧度）
        const vertical_height = distance * Math.sin(this.radians(elevation));
        // 水平距离
        const horizontal_distance =
            distance * Math.cos(this.radians(elevation));

        // 归一化 azimuth 到 [0, 360]
        if (azimuth > 360) azimuth = azimuth % 360;
        if (azimuth < 0) azimuth = 360 + (azimuth % 360);

        const point1 = this.lonLat2WebMercator(point);
        let lnglat: Point = { x: 0, y: 0 };
        let x_length: number, y_length: number;

        if (azimuth <= 90) {
            // 第四象限
            x_length = horizontal_distance * Math.cos(this.radians(azimuth));
            y_length = horizontal_distance * Math.sin(this.radians(azimuth));
            lnglat = {
                x: point1.x + x_length,
                y: point1.y - y_length,
            };
        } else if (azimuth > 90 && azimuth <= 180) {
            // 第三象限
            x_length =
                horizontal_distance * Math.sin(this.radians(azimuth - 90));
            y_length =
                horizontal_distance * Math.cos(this.radians(azimuth - 90));
            lnglat = {
                x: point1.x - x_length,
                y: point1.y - y_length,
            };
        } else if (azimuth > 180 && azimuth <= 270) {
            // 第二象限
            x_length =
                horizontal_distance * Math.cos(this.radians(azimuth - 180));
            y_length =
                horizontal_distance * Math.sin(this.radians(azimuth - 180));
            lnglat = {
                x: point1.x - x_length,
                y: point1.y + y_length,
            };
        } else {
            // 第一象限（azimuth > 270 && azimuth <= 360）
            x_length =
                horizontal_distance * Math.sin(this.radians(azimuth - 270));
            y_length =
                horizontal_distance * Math.cos(this.radians(azimuth - 270));
            lnglat = {
                x: point1.x + x_length,
                y: point1.y + y_length,
            };
        }
        const lonlat = this.webMercator2LonLat(lnglat);
        return {
            lng: lonlat.x,
            lat: lonlat.y,
            height: vertical_height,
        };
    }

    /**
     * 经纬度转 Web 墨卡托坐标
     */
    lonLat2WebMercator(lonLat: Point): Point {
        const x = (lonLat.x * this.a) / 180;
        let y =
            Math.log(Math.tan(((90 + lonLat.y) * this.PI) / 360)) /
            (this.PI / 180);
        y = (y * this.a) / 180;
        return { x, y };
    }

    /**
     * Web 墨卡托转经纬度
     */
    webMercator2LonLat(mercator: Point): Point {
        const x = (mercator.x / this.a) * 180;
        const latRadians =
            2 * Math.atan(Math.exp(mercator.y / this.a)) - this.PI / 2;
        const y = latRadians * (180 / this.PI);
        return { x, y };
    }

    /**
     * 计算反正切（修正象限）
     */
    get_atan(z: number, y: number): number {
        let x: number;
        if (z === 0) {
            x = this.PI / 2;
        } else {
            if (y === 0) {
                x = this.PI;
            } else {
                x = Math.atan(Math.abs(y / z));
                if (y > 0 && z < 0) {
                    x = this.PI - x;
                } else if (y < 0 && z < 0) {
                    x = this.PI + x;
                } else if (y < 0 && z > 0) {
                    x = 2 * this.PI - x;
                }
            }
        }
        return x;
    }

    /**
     * WGS84 转 ECEF 坐标系
     */
    ConvertLLAToXYZ(LLACoor: LLACoordinate): ECEFCoordinate {
        const lon = (this.PI / 180) * LLACoor.longitude;
        const lat = (this.PI / 180) * LLACoor.latitude;
        const H = LLACoor.altitude;
        const N0 = this.a / Math.sqrt(1.0 - this.ee * Math.sin(lat) ** 2);
        const x = (N0 + H) * Math.cos(lat) * Math.cos(lon);
        const y = (N0 + H) * Math.cos(lat) * Math.sin(lon);
        const z = (N0 * (1.0 - this.ee) + H) * Math.sin(lat);
        return { x, y, z };
    }

    /**
     * ECEF 坐标系转 WGS84
     */
    ConvertXYZToLLA(XYZCoor: ECEFCoordinate): LLACoordinate {
        let longitude = this.get_atan(XYZCoor.x, XYZCoor.y);
        if (longitude < 0) {
            longitude = longitude + this.PI;
        }
        let latitude = this.get_atan(
            Math.sqrt(XYZCoor.x ** 2 + XYZCoor.y ** 2),
            XYZCoor.z
        );

        let W = Math.sqrt(1 - this.WGSe2 * Math.sin(latitude) ** 2);
        let N = this.WGSa / W;
        let B1: number;
        do {
            B1 = latitude;
            W = Math.sqrt(1 - this.WGSe2 * Math.sin(B1) ** 2);
            N = this.WGSa / W;
            latitude = this.get_atan(
                Math.sqrt(XYZCoor.x ** 2 + XYZCoor.y ** 2),
                XYZCoor.z + N * this.WGSe2 * Math.sin(B1)
            );
        } while (Math.abs(latitude - B1) > this.EPSILON);

        const altitude =
            Math.sqrt(XYZCoor.x ** 2 + XYZCoor.y ** 2) / Math.cos(latitude) -
            this.WGSa / Math.sqrt(1 - this.WGSe2 * Math.sin(latitude) ** 2);

        return {
            longitude: (longitude * 180) / this.PI,
            latitude: (latitude * 180) / this.PI,
            altitude,
        };
    }

    /**
     * 北东天坐标系转 WGS84
     * @param a 参考点（LLA 坐标）
     * @param p 方位参数：距离、方位角、仰角
     */
    enu_to_ecef(a: LLACoordinate, p: ENUParams): LLACoordinate {
        const { distance, azimuth, elevation } = p;

        const zUp =
            elevation >= 0
                ? distance * Math.sin(this.radians(elevation))
                : -distance * Math.sin(this.radians(Math.abs(elevation)));
        const d = distance * Math.cos(this.radians(Math.abs(elevation)));
        let xEast: number, yNorth: number;
        if (azimuth <= 90) {
            xEast = d * Math.sin(this.radians(azimuth));
            yNorth = d * Math.cos(this.radians(azimuth));
        } else if (azimuth > 90 && azimuth < 180) {
            xEast = d * Math.cos(this.radians(azimuth - 90));
            yNorth = -d * Math.sin(this.radians(azimuth - 90));
        } else if (azimuth > 180 && azimuth < 270) {
            xEast = -d * Math.sin(this.radians(azimuth - 180));
            yNorth = -d * Math.cos(this.radians(azimuth - 180));
        } else {
            xEast = -d * Math.sin(this.radians(360 - azimuth));
            yNorth = d * Math.cos(this.radians(360 - azimuth));
        }

        const lamb = this.radians(a.latitude);
        const phi = this.radians(a.longitude);
        const h0 = a.altitude;

        const s = Math.sin(lamb);
        const N = this.a / Math.sqrt(1.0 - this.e_sq * s * s);

        const sin_lambda = Math.sin(lamb);
        const cos_lambda = Math.cos(lamb);
        const sin_phi = Math.sin(phi);
        const cos_phi = Math.cos(phi);

        const x0 = (h0 + N) * cos_lambda * cos_phi;
        const y0 = (h0 + N) * cos_lambda * sin_phi;
        const z0 = (h0 + (1 - this.e_sq) * N) * sin_lambda;

        const t = cos_lambda * zUp - sin_lambda * yNorth;
        const zd = sin_lambda * zUp + cos_lambda * yNorth;
        const xd = cos_phi * t - sin_phi * xEast;
        const yd = sin_phi * t + cos_phi * xEast;

        return this.ConvertXYZToLLA({
            x: xd + x0,
            y: yd + y0,
            z: zd + z0,
        });
    }

    /**
     * 将角度转换为弧度
     */
    radians(degree: number): number {
        return (this.PI / 180) * degree;
    }
}
