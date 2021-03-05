import WebSocket from "ws";
// using System;
// using WebSocketSharp;
// using Newtonsoft.Json;
// using System.Timers;
// using System.Text;
// using System.IO;
// using NAudio.Wave;

// // 参考: https://gist.github.com/kevinswiber/1390198

// // TODO: logging

// namespace WsNaudio
// {
//     public class Message
//     {
//         public string action { get; set; }
//         public dynamic payload { get; set; }

//         public Message(string _action, dynamic _payload) =>
//             (action, payload) = (_action, _payload);
//     }

//     public class Credential
//     {
//         public string userId { get; set; }
//         public string orgId { get; set; }
//         public string signature { get; set; }

//         public Credential(string _userId, string _orgId, string _signature) =>
//             (userId, orgId, signature) = (_userId, _orgId, _signature);
//     }

//     class Program
//     {
//         private static Timer timer = null;
//         private static WebSocket ws = null;
//         private static WasapiLoopbackCapture output = null;
//         private static WaveInEvent input = null;

//         private static void HeartBeat()
//         {
//             if(timer != null) {
//                 timer.Stop();
//                 timer.Dispose();
//             }

//             timer = new Timer(30000 + 1000);
//             timer.Elapsed += (Object source, ElapsedEventArgs e) =>
//             {
//                 if(ws != null)
//                 {
//                     ws.Close(); // onCloseへ
//                 }
//             };
//             timer.AutoReset = false;
//             timer.Enabled = true;
//         }

//         private static void MakeWsConnection(Credential cred) {
//             ws = new WebSocket($"ws://localhost:4000/kiki/?type=kazana&signature={cred.signature}=&userId={cred.userId}&orgId={cred.orgId}");

//             try {
//                 ws.OnOpen += (sender, e) => {
//                     Message msg = new Message("kiki-connected", null);
//                     Console.WriteLine(JsonConvert.SerializeObject(msg));
//                     HeartBeat();
//                 };

//                 // TODO: retryを実装（参照: https://github.com/sta/websocket-sharp/issues/511）
//                 ws.OnClose += (sender, e) => {
//                     Message msg = new Message("kiki-disconnected", null);
//                     Console.WriteLine(JsonConvert.SerializeObject(msg));
//                     if(timer != null) {
//                         timer.Stop();
//                         timer.Dispose();
//                     }
//                 };

//                 ws.OnError += (sender, e) => {
//                     Message msg = new Message("kiki-disconnected", null);
//                     Console.WriteLine(JsonConvert.SerializeObject(msg));
//                     if(timer != null) {
//                         timer.Stop();
//                         timer.Dispose();
//                     }
//                 };

//                 ws.OnMessage += (sender, e) => {
//                     Message msg = JsonConvert.DeserializeObject<Message>(e.Data);
//                     switch(msg.action) {
//                         case "ping":
//                             Message pingMsg = new Message("pong", null);
//                             ws.Send(JsonConvert.SerializeObject(pingMsg));
//                             HeartBeat();
//                             break;
//                         case "start-talk":
//                             // var waveFormat = new NAudio.Wave.WaveFormat(16000, 1); // encodingは、デフォルトでlinear PCM

//                             // output = new WasapiLoopbackCapture()
//                             // {
//                             //     WaveFormat = waveFormat
//                             // };
//                             // input = new WaveInEvent()
//                             // {
//                             //     WaveFormat = waveFormat
//                             // };

//                             // var targetFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "KAZANA_TEST");
//                             // var timestamp = DateTime.Now.ToString("yyyyMMddHHmmssffff");
//                             // var outputFilePath = Path.Combine(targetFolder, $"output-{msg.payload.talkId.ToString()}-{timestamp}");
//                             // var inputFilePath = Path.Combine(targetFolder, $"input-{msg.payload.talkId.ToString()}-{timestamp}");
//                             // var outputWriter = new WaveFileWriter(outputFilePath, waveFormat);
//                             // var inputWriter = new WaveFileWriter(inputFilePath, waveFormat);

//                             // output.DataAvailable += (s, a) =>
//                             // {
//                             //     outputWriter.Write(a.Buffer, 0, a.BytesRecorded);
//                             // };
//                             // input.DataAvailable += (s, a) =>
//                             // {
//                             //     inputWriter.Write(a.Buffer, 0, a.BytesRecorded);
//                             // };

//                             // output.StartRecording();
//                             // input.StartRecording();

//                             Console.WriteLine(JsonConvert.SerializeObject(msg));
//                             break;
//                         case "end-talk":
//                             // TODO: api serverの/s3にrequestを送って音声ファイルをアップロードする。
//                             // output.StopRecording();
//                             // output.Dispose();
//                             // output = null;
//                             // input.StopRecording();
//                             // input.Dispose();
//                             // input = null;

//                             Console.WriteLine(JsonConvert.SerializeObject(msg));
//                             break;
//                         default:
//                             Console.WriteLine(JsonConvert.SerializeObject(msg));
//                             break;
//                     }
//                 };

//                 ws.Connect();
//             } catch {
//                 if(ws != null) {
//                     ws.Close();
//                     ws = null;
//                 }

//                 if(output != null) {
//                     output.Dispose();
//                     output = null;
//                 }

//                 if(input != null) {
//                     input.Dispose();
//                     input = null;
//                 }
//             }
//         }

//         static void Main(string[] args)
//         {
//             var input = Console.OpenStandardInput();
//             var buffer = new byte[1024];
//             int length;

//             while(input.CanRead && (length = input.Read(buffer, 0, buffer.Length)) > 0)
//             {
//                 var payload = new byte[length];
//                 Buffer.BlockCopy(buffer, 0, payload, 0, length);
//                 string message = Encoding.UTF8.GetString(payload);

//                 Message msg = JsonConvert.DeserializeObject<Message>(message);
//                 switch(msg.action) {
//                     case "login":
//                         Credential cred = new Credential(msg.payload.userId.ToString(), msg.payload.orgId.ToString(), msg.payload.signature.ToString());
//                         MakeWsConnection(cred);
//                         break;
//                     case "logout":
//                         if(ws != null) {
//                             ws.Close();
//                             ws = null;
//                         }
//                         break;
//                 }
//             }
//         }
//     }
// }
