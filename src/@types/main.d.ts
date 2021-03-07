/**
 * Things that is be shared with main EKAKI package.
 */

interface InvitationBackend {
  _id: string;

  org: string;
  role: string;
  invitedBy: string;
  invitedDate: Date;
}

interface MembershipBackend {
  _id: string;

  org: string;
  isDefault: boolean;
}

interface UserBackend {
  _id: string;

  firstname?: string;
  lastname?: string;
  email: string;
  password?: string;
  /**
   * ユーザーのアイコン
   *
   * 初めてのユーザーでも同じデフォルトのアイコンが挿入されるので、絶対ある。
   */
  icon: string;
  secretKey?: string;
  twoFactor: boolean;

  googleId?: string;

  membership: MembershipBackend[];

  isVerified: boolean;
  verifiedDate?: Date;

  invitations: InvitationBackend[];
}

/**
 * Connection states. Each one is mutually exclusive.
 * Color codes:
 * - talking -> purle
 * - waiting -> blue
 * - kiki-disconnected & client-disconnected -> yellow
 * - logout -> red
 * - no-network -> gray
 */
type ConnStates =
  | "talking"
  | "waiting"
  | "client-disconnected"
  | "kiki-disconnected"
  | "logout"
  | "no-network";

type KIKIAction = "message";

type KIKIMessage = {
  action:
    | "ping"
    | "start-talk"
    | "end-talk"
    | "client-connected"
    | "client-disconnected"
    | "kiki-connected"
    | "kiki-disconnected";
  payload?: any;
};
