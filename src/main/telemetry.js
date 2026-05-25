const { EventEmitter } = require('events');

class TelemetryBridge extends EventEmitter {
  constructor() {
    super();
    this.connected = false;
    this.mock = false;
    this._interval = null;
    this._mockState = null;
    this._drivers = [];
    this._sessionType = '';
    this._numCarClasses = 1;
    this._lastSessionNum = 0;
    this._trackName = '';
    this._playerCarIdx = 0;
  }

  start() {
    try {
      const irsdk = require('node-irsdk-2023');
      console.log('[Telemetry] node-irsdk-2023 loaded, waiting for iRacing...');
      this._startReal(irsdk);
    } catch (err) {
      console.log('[Telemetry] node-irsdk-2023 not available, starting mock mode:', err.message);
      this.mock = true;
      this._startMock();
    }
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this.connected = false;
    this.emit('connectionState', false);
  }

  _startReal(irsdk) {
    const instance = irsdk.getInstance();

    instance.on('Connected', () => {
      console.log('[Telemetry] connected to iRacing');
      this.connected = true;
      this.emit('connectionState', true);
    });

    instance.on('Disconnected', () => {
      console.log('[Telemetry] disconnected from iRacing');
      this.connected = false;
      this.emit('connectionState', false);
    });

    instance.on('Telemetry', (evt) => {
      const values = evt.values;
      if (values && values.SessionNum !== undefined) {
        this._lastSessionNum = values.SessionNum;
      }
      if (values && !this._diagLoggedTires) {
        this._diagLoggedTires = true;
        const tireKeys = Object.keys(values).filter(k => /press|temp|tire|wear/i.test(k)).sort();
        console.log('[Diag] tire-related telemetry keys:', tireKeys.join(', '));
        for (const k of tireKeys) {
          console.log(`[Diag]   ${k} = ${values[k]}`);
        }
      }
      const slim = this._slim(values);
      if (slim) {
        slim.drivers = this._drivers;
        this.emit('telemetry', slim);
      }
    });

    instance.on('SessionInfo', (evt) => {
      this._parseSessionInfo(evt.data);
      this.emit('sessionInfo', evt.data);
    });
  }

  _startMock() {
    this._mockState = this._createMockState();
    this.connected = true;
    this.emit('connectionState', true);

    // Emit mock session info so calibration manager can set carPath
    const mockDrivers = this._mockState.cars.map(c => ({
      name: c.name,
      carNum: c.carNum,
      iRating: c.iRating,
      license: c.license,
      classColor: c.classColor,
      classId: c.classId,
      carPath: c.classId === 1 ? 'porsche_992_cup' : c.classId === 2 ? 'dallara_p217' : 'bmw_m4_gt4',
    }));
    this._drivers = mockDrivers;
    setTimeout(() => this.emit('sessionInfo', {}), 100);

    this._interval = setInterval(() => {
      this._updateMockState();
      this.emit('telemetry', this._getMockTelemetry());
    }, 1000 / 30); // 30Hz
  }

  _createMockState() {
    // Multiclass field: 3 classes, 12 cars total
    // GT3 (yellow) = classId 1, LMP3 (blue) = classId 2, GT4 (green) = classId 3
    const drivers = [
      // GT3 class — 5 cars
      { name: 'Max Verstappen', carNum: '1', iRating: 5500, license: 'P4.2', classColor: 0xFFDD00, classId: 1 },
      { name: 'Lewis Hamilton', carNum: '44', iRating: 5200, license: 'A4.8', classColor: 0xFFDD00, classId: 1 },
      { name: 'Charles Leclerc', carNum: '16', iRating: 4800, license: 'A4.7', classColor: 0xFFDD00, classId: 1 },
      { name: 'Lando Norris', carNum: '4', iRating: 4600, license: 'B4.1', classColor: 0xFFDD00, classId: 1 },
      { name: 'Carlos Sainz', carNum: '55', iRating: 4400, license: 'B3.9', classColor: 0xFFDD00, classId: 1 },
      // LMP3 class — 4 cars (player is here)
      { name: 'You', carNum: '99', iRating: 3200, license: 'C3.2', classColor: 0x00AAFF, classId: 2 },
      { name: 'Fernando Alonso', carNum: '14', iRating: 3500, license: 'A4.5', classColor: 0x00AAFF, classId: 2 },
      { name: 'Oscar Piastri', carNum: '81', iRating: 3100, license: 'B4.0', classColor: 0x00AAFF, classId: 2 },
      { name: 'George Russell', carNum: '63', iRating: 3400, license: 'A4.3', classColor: 0x00AAFF, classId: 2 },
      // GT4 class — 3 cars
      { name: 'Pierre Gasly', carNum: '10', iRating: 2800, license: 'C2.8', classColor: 0x44BB44, classId: 3 },
      { name: 'Yuki Tsunoda', carNum: '22', iRating: 2600, license: 'B3.5', classColor: 0x44BB44, classId: 3 },
      { name: 'Zhou Guanyu', carNum: '24', iRating: 2400, license: 'C2.4', classColor: 0x44BB44, classId: 3 },
    ];

    // Generate realistic best/last lap times (base ~90s at Okayama)
    const baseLap = 90;
    const numCars = drivers.length;
    const cars = drivers.map((d, i) => ({
      ...d,
      idx: i,
      lapDistPct: i / numCars,
      speed: 45 + Math.random() * 5, // m/s at Okayama
      inPit: false,
      lap: 1,
      position: i + 1,
      classPosition: 0, // computed below
      bestLapTime: baseLap + (i * 0.3) + (Math.random() * 0.5),
      lastLapTime: baseLap + (i * 0.3) + (Math.random() * 1.0),
    }));

    // Alternate session types every 30s for dev validation
    const sessionTypes = ['Practice', 'Qualifying', 'Race'];

    return {
      cars,
      playerIdx: 5,
      trackLength: 3703, // Okayama ~3.7km
      sessionTypes,
      sessionTypeIdx: 0,
      sessionSwitchCounter: 0,
      // Inputs mock state
      mockThrottle: 0,
      mockBrake: 0,
      mockClutch: 0,
      mockSteering: 0,
      mockInputPhase: 0, // drives a repeating lap-like cycle
      // Fuel mock state
      fuelLevel: 40, // start with 40L
      fuelPerLap: 2.4, // ~2.4L per lap at Okayama
      sessionTimeRemain: 1200, // 20 min timed session
      // Tires mock state — pressures are live, temps are snapshot per lap
      tirePressure: { LF: 148, RF: 150, LR: 145, RR: 147 },
      tireTemp: {
        LF: { CL: 82, CM: 88, CR: 85 },
        RF: { CL: 84, CM: 90, CR: 87 },
        LR: { CL: 78, CM: 83, CR: 80 },
        RR: { CL: 80, CM: 85, CR: 82 },
      },
      tireTempLap: 0, // lap number of last temp snapshot
      // Spotter mock state — cycles 4 scenarios every 4s
      spotterScenario: 0,
      spotterCounter: 0,
    };
  }

  _updateMockState() {
    const { cars, trackLength } = this._mockState;
    const dt = 1 / 30;

    for (const car of cars) {
      const speedVariation = (Math.random() - 0.5) * 2;
      car.speed = Math.max(30, Math.min(60, car.speed + speedVariation));
      const prevDist = car.lapDistPct;
      car.lapDistPct += (car.speed * dt) / trackLength;
      if (car.lapDistPct >= 1) {
        car.lapDistPct -= 1;
        car.lap++;
        // Simulate new lap times on lap completion
        car.lastLapTime = 88 + Math.random() * 4;
        if (car.lastLapTime < car.bestLapTime) {
          car.bestLapTime = car.lastLapTime;
        }
      }
    }

    // Sort by position (lap count + lapDistPct)
    const sorted = [...cars].sort((a, b) => {
      const aProgress = a.lap + a.lapDistPct;
      const bProgress = b.lap + b.lapDistPct;
      return bProgress - aProgress;
    });
    sorted.forEach((car, i) => { car.position = i + 1; });

    // Compute class positions
    const classCounts = {};
    for (const car of sorted) {
      classCounts[car.classId] = (classCounts[car.classId] || 0) + 1;
      car.classPosition = classCounts[car.classId];
    }

    // Fuel: consume continuously and tick session time
    const s = this._mockState;
    s.fuelLevel = Math.max(0, s.fuelLevel - (s.fuelPerLap / 90) * dt); // ~2.4L per 90s lap
    s.sessionTimeRemain = Math.max(0, s.sessionTimeRemain - dt);

    // Tires: pressure drifts live, temp snapshots on player lap cross
    const corners = ['LF', 'RF', 'LR', 'RR'];
    for (const c of corners) {
      s.tirePressure[c] += (Math.random() - 0.48) * 0.05; // slight upward drift (heat buildup)
      s.tirePressure[c] = Math.max(130, Math.min(165, s.tirePressure[c]));
    }
    const playerCar = s.cars[s.playerIdx];
    if (playerCar.lap > s.tireTempLap && s.tireTempLap >= 0) {
      // New lap crossed — snapshot temperatures
      s.tireTempLap = playerCar.lap;
      for (const c of corners) {
        s.tireTemp[c].CL = 70 + Math.random() * 40;
        s.tireTemp[c].CM = 75 + Math.random() * 40;
        s.tireTemp[c].CR = 72 + Math.random() * 38;
      }
    }

    // Alternate session type every ~30s (900 ticks at 30Hz)
    this._mockState.sessionSwitchCounter++;
    if (this._mockState.sessionSwitchCounter >= 900) {
      this._mockState.sessionSwitchCounter = 0;
      this._mockState.sessionTypeIdx =
        (this._mockState.sessionTypeIdx + 1) % this._mockState.sessionTypes.length;
    }

    // Simulate realistic input traces (repeating ~8s cycle)
    s.mockInputPhase += dt;
    const t = s.mockInputPhase % 8; // 8s cycle
    if (t < 2) {
      // Straight: full throttle
      s.mockThrottle = 0.9 + Math.random() * 0.1;
      s.mockBrake = 0;
      s.mockSteering = (Math.random() - 0.5) * 0.05;
    } else if (t < 2.8) {
      // Braking zone
      s.mockThrottle = 0;
      s.mockBrake = 0.7 + Math.random() * 0.3;
      s.mockSteering = (Math.random() - 0.5) * 0.1;
    } else if (t < 4.5) {
      // Cornering: trail brake + partial throttle
      const cornerPct = (t - 2.8) / 1.7;
      s.mockThrottle = cornerPct * 0.6;
      s.mockBrake = Math.max(0, 0.3 * (1 - cornerPct));
      s.mockSteering = Math.sin(cornerPct * Math.PI) * 0.7;
    } else if (t < 6) {
      // Exit: full throttle, unwinding
      s.mockThrottle = 0.8 + Math.random() * 0.2;
      s.mockBrake = 0;
      const exitPct = (t - 4.5) / 1.5;
      s.mockSteering = 0.7 * (1 - exitPct);
    } else {
      // Another straight
      s.mockThrottle = 0.95 + Math.random() * 0.05;
      s.mockBrake = 0;
      s.mockSteering = (Math.random() - 0.5) * 0.03;
    }
    s.mockClutch = 0; // no clutch in normal driving

    // Spotter: cycle 4 scenarios every 4s (120 ticks at 30Hz)
    s.spotterCounter++;
    if (s.spotterCounter >= 120) {
      s.spotterCounter = 0;
      s.spotterScenario = (s.spotterScenario + 1) % 4;
    }
  }

  _getMockTelemetry() {
    const s = this._mockState;
    const { cars, playerIdx, sessionTypes, sessionTypeIdx } = s;

    return {
      CarIdxLapDistPct: cars.map(c => c.lapDistPct),
      CarIdxPosition: cars.map(c => c.position),
      CarIdxClassPosition: cars.map(c => c.classPosition),
      CarIdxLap: cars.map(c => c.lap),
      CarIdxOnPitRoad: cars.map(c => c.inPit),
      CarIdxEstTime: cars.map(c => 90 + Math.random() * 2),
      CarIdxLastLapTime: cars.map(c => c.lastLapTime),
      CarIdxBestLapTime: cars.map(c => c.bestLapTime),
      PlayerCarIdx: playerIdx,
      SessionNum: 0,
      SessionFlags: 0,
      SessionType: sessionTypes[sessionTypeIdx],
      Throttle: s.mockThrottle,
      Brake: s.mockBrake,
      Clutch: s.mockClutch,
      SteeringWheelAngle: s.mockSteering,
      Gear: Math.max(1, Math.min(6, Math.round(s.mockThrottle * 4 + 2))),
      RPM: 3000 + s.mockThrottle * 5000 + Math.random() * 200,
      Speed: 20 + s.mockThrottle * 50,
      TrackName: 'Okayama International Circuit',
      TrackLength: s.trackLength,
      CarLeftRight: this._getSpotterCarLeftRight(s),
      Yaw: cars[playerIdx].lapDistPct * Math.PI * 2,
      VelocityX: 0,
      VelocityY: cars[playerIdx].speed,
      FuelLevel: s.fuelLevel,
      FuelUsePerHour: (s.fuelPerLap / 90) * 3600,
      LapLastLapTime: cars[playerIdx].lastLapTime,
      SessionTimeRemain: s.sessionTimeRemain,
      Lap: cars[playerIdx].lap,
      LFpressure: s.tirePressure.LF,
      RFpressure: s.tirePressure.RF,
      LRpressure: s.tirePressure.LR,
      RRpressure: s.tirePressure.RR,
      LFtempCL: s.tireTemp.LF.CL,
      LFtempCM: s.tireTemp.LF.CM,
      LFtempCR: s.tireTemp.LF.CR,
      RFtempCL: s.tireTemp.RF.CL,
      RFtempCM: s.tireTemp.RF.CM,
      RFtempCR: s.tireTemp.RF.CR,
      LRtempCL: s.tireTemp.LR.CL,
      LRtempCM: s.tireTemp.LR.CM,
      LRtempCR: s.tireTemp.LR.CR,
      RRtempCL: s.tireTemp.RR.CL,
      RRtempCM: s.tireTemp.RR.CM,
      RRtempCR: s.tireTemp.RR.CR,
      TireTempLap: s.tireTempLap,
      NumCarClasses: 3,
      drivers: cars.map(c => ({
        name: c.name,
        carNum: c.carNum,
        iRating: c.iRating,
        license: c.license,
        classColor: c.classColor,
        classId: c.classId,
        carPath: c.classId === 1 ? 'porsche_992_cup' : c.classId === 2 ? 'dallara_p217' : 'bmw_m4_gt4',
      })),
    };
  }

  _getSpotterCarLeftRight(s) {
    // Cycle through 4 scenarios: 1=clear, 2=left, 4=left+right, mixed(3=right)
    const scenarios = [1, 2, 4, 3];
    return scenarios[s.spotterScenario];
  }

  _slim(data) {
    if (!data) return null;
    return {
      CarIdxLapDistPct: data.CarIdxLapDistPct,
      CarIdxPosition: data.CarIdxPosition,
      CarIdxClassPosition: data.CarIdxClassPosition,
      CarIdxLap: data.CarIdxLap,
      CarIdxOnPitRoad: data.CarIdxOnPitRoad,
      CarIdxEstTime: data.CarIdxEstTime,
      CarIdxLastLapTime: data.CarIdxLastLapTime,
      CarIdxBestLapTime: data.CarIdxBestLapTime,
      PlayerCarIdx: data.PlayerCarIdx,
      SessionNum: data.SessionNum,
      SessionFlags: data.SessionFlags,
      SessionType: this._sessionType,
      NumCarClasses: this._numCarClasses,
      TrackName: this._trackName,
      Throttle: data.Throttle,
      Brake: data.Brake,
      Clutch: data.Clutch,
      SteeringWheelAngle: data.SteeringWheelAngle,
      Gear: data.Gear,
      RPM: data.RPM,
      Speed: data.Speed,
      CarLeftRight: data.CarLeftRight,
      TrackLength: data.TrackLength,
      Yaw: data.Yaw,
      VelocityX: data.VelocityX,
      VelocityY: data.VelocityY,
      FuelLevel: data.FuelLevel,
      FuelUsePerHour: data.FuelUsePerHour,
      LapLastLapTime: data.LapLastLapTime,
      SessionTimeRemain: data.SessionTimeRemain,
      Lap: data.Lap,
      LFpressure: data.LFpressure,
      RFpressure: data.RFpressure,
      LRpressure: data.LRpressure,
      RRpressure: data.RRpressure,
      LFtempCL: data.LFtempCL,
      LFtempCM: data.LFtempCM,
      LFtempCR: data.LFtempCR,
      RFtempCL: data.RFtempCL,
      RFtempCM: data.RFtempCM,
      RFtempCR: data.RFtempCR,
      LRtempCL: data.LRtempCL,
      LRtempCM: data.LRtempCM,
      LRtempCR: data.LRtempCR,
      RRtempCL: data.RRtempCL,
      RRtempCM: data.RRtempCM,
      RRtempCR: data.RRtempCR,
      TireTempLap: data.TireTempLap,
    };
  }

  _parseSessionInfo(sessionInfo) {
    try {
      const driverInfo = sessionInfo?.DriverInfo;
      if (driverInfo && driverInfo.Drivers && !this._diagLoggedDrivers) {
        this._diagLoggedDrivers = true;
        const playerCarIdx = driverInfo.DriverCarIdx;
        const player = driverInfo.Drivers.find(d => d.CarIdx === playerCarIdx);
        if (player) {
          console.log('[Diag] player driver fields:', Object.keys(player).join(', '));
          console.log('[Diag] player IRating:', player.IRating, 'CarIdx:', player.CarIdx, 'Name:', player.UserName);
          const irKeys = Object.keys(player).filter(k => /rating|ir|license/i.test(k));
          for (const k of irKeys) {
            console.log(`[Diag]   ${k} = ${JSON.stringify(player[k])}`);
          }
        }
      }
      if (driverInfo && driverInfo.Drivers) {
        // Index drivers by CarIdx so this._drivers[i] matches CarIdx-keyed
        // telemetry arrays (CarIdxLapDistPct, CarIdxPosition, etc.).
        // iRacing's DriverInfo.Drivers list can contain a pace car entry and
        // may not be densely packed, so a plain .map() breaks the indexing.
        const indexed = [];
        for (const d of driverInfo.Drivers) {
          const carIdx = d.CarIdx;
          if (carIdx == null || carIdx < 0) continue;
          indexed[carIdx] = {
            name: d.UserName || d.TeamName || '',
            carNum: String(d.CarNumber || ''),
            iRating: d.IRating || 0,
            license: (d.LicString || '').charAt(0) || '',
            classColor: d.CarClassColor != null ? parseInt(d.CarClassColor, 16) : 0xFFFF00,
            classId: d.CarClassID != null ? d.CarClassID : 0,
            carPath: d.CarPath || '',
          };
        }
        this._drivers = indexed;
      }
      if (driverInfo && driverInfo.DriverCarIdx != null) {
        this._playerCarIdx = driverInfo.DriverCarIdx;
      }

      // Extract current session type
      const sessions = sessionInfo?.SessionInfo?.Sessions;
      const sessionNum = this._lastSessionNum;
      if (sessions && sessionNum != null && sessions[sessionNum]) {
        this._sessionType = sessions[sessionNum].SessionType || '';
      }

      // Detect multiclass and track name
      const weekendInfo = sessionInfo?.WeekendInfo;
      if (weekendInfo) {
        if (weekendInfo.NumCarClasses != null) this._numCarClasses = weekendInfo.NumCarClasses;
        if (weekendInfo.TrackDisplayName) this._trackName = weekendInfo.TrackDisplayName;
      }
    } catch (err) {
      console.warn('[Telemetry] SessionInfo parse failed:', err.message);
    }
  }
}

module.exports = TelemetryBridge;
