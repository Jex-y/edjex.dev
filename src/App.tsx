import { Card } from "./componets/Card";

function App() {
  return (
    <div className="container mx-auto py-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="col-span-2 flex flex-col bg-gradient-to-tl from-[#00f5a0] to-[#00d9f5]">
          <div className="flex flex-row justify-between gap-4">
            <div className="rounded-full w-32 h-32 bg-white" />
            <div className="flex flex-col flex-1">
              <h1 className="text-2xl font-bold content-center font-montserrat">
                Edward Jex
              </h1>
              <h2 className="text-lg font-semibold">
                Computer Science Masters Student
              </h2>
              <p className="text mt-2">
                Hi, I'm Ed, a 4th year integrated mastesrs student styding at
                Durham Univeristy in the UK. I have a wide range of intrests
                include tiny ML, computer vision, web development, embedded
                systems, and DevOps.
              </p>
            </div>
          </div>
        </Card>
        <Card className="col-span-2" title="Projects">
          <Card title="River Level Forecasting">
            <p>
              I am currently developing a project to forecast river level in
              Durham using machine learning.
            </p>
          </Card>
        </Card>
      </div>
    </div>
  );
}

export default App;
