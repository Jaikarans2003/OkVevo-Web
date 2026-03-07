declare module 'threejs-components/build/cursors/tubes1.min.js' {
  interface TubesConfig {
    tubes?: {
      colors?: string[];
      lights?: {
        intensity?: number;
        colors?: string[];
      };
    };
  }

  interface TubesApp {
    tubes: {
      setColors: (colors: string[]) => void;
      setLightsColors: (colors: string[]) => void;
    };
  }

  function TubesCursor(canvas: HTMLCanvasElement, config?: TubesConfig): TubesApp;
  
  export default TubesCursor;
}
