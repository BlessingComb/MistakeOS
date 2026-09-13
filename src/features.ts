/** Product switches are deliberately local. Server-side enforcement lives in SQL. */
export const socialCirclesEnabled = false;

/** Demo data may only exist in a development bundle and requires an explicit opt-in. */
export const classroomDemoEnabled =
  typeof __DEV__ !== 'undefined'
  && __DEV__
  && process.env.EXPO_PUBLIC_MISTAKEOS_CLASSROOM_DEMO === 'true';
